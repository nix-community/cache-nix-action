import * as core from '@actions/core'
import {HttpClient, HttpClientResponse} from '@actions/http-client'
import {BlockBlobClient} from '@azure/storage-blob'
import {TransferProgressEvent} from '@azure/ms-rest-js'
import * as buffer from 'buffer'
import * as fs from 'fs'
import * as stream from 'stream'
import * as util from 'util'

import * as utils from './cacheUtils'
import {SocketTimeout} from './constants'
import {DownloadOptions} from '../options'
import {retryHttpClientResponse} from './requestUtils'

import {AbortController} from '@azure/abort-controller'
import {Storage, TransferManager} from '@google-cloud/storage'
import {ChildProcessWithoutNullStreams, spawn} from 'child_process'

/**
 * Pipes the body of a HTTP response to a stream
 *
 * @param response the HTTP response
 * @param output the writable stream
 */
async function pipeResponseToStream(
  response: HttpClientResponse,
  output: NodeJS.WritableStream,
  progress?: DownloadProgress
): Promise<void> {
  const pipeline = util.promisify(stream.pipeline)
  await pipeline(
    response.message,
    new stream.Transform({
      transform(chunk, encoding, callback) {
        if (progress) {
          progress.setReceivedBytes(
            progress.getTransferredBytes() + chunk.length
          )
        }
        this.push(chunk)
        callback()
      }
    }),
    output
  )
}

/**
 * Class for tracking the download state and displaying stats.
 */
export class DownloadProgress {
  contentLength: number
  segmentIndex: number
  segmentSize: number
  segmentOffset: number
  receivedBytes: number
  startTime: number
  displayedComplete: boolean
  timeoutHandle?: ReturnType<typeof setTimeout>

  constructor(contentLength: number) {
    this.contentLength = contentLength
    this.segmentIndex = 0
    this.segmentSize = 0
    this.segmentOffset = 0
    this.receivedBytes = 0
    this.displayedComplete = false
    this.startTime = Date.now()
  }

  /**
   * Progress to the next segment. Only call this method when the previous segment
   * is complete.
   *
   * @param segmentSize the length of the next segment
   */
  nextSegment(segmentSize: number): void {
    this.segmentOffset = this.segmentOffset + this.segmentSize
    this.segmentIndex = this.segmentIndex + 1
    this.segmentSize = segmentSize
    this.receivedBytes = 0

    core.debug(
      `Downloading segment at offset ${this.segmentOffset} with length ${this.segmentSize}...`
    )
  }

  /**
   * Sets the number of bytes received for the current segment.
   *
   * @param receivedBytes the number of bytes received
   */
  setReceivedBytes(receivedBytes: number): void {
    this.receivedBytes = receivedBytes
  }

  /**
   * Returns the total number of bytes transferred.
   */
  getTransferredBytes(): number {
    return this.segmentOffset + this.receivedBytes
  }

  /**
   * Returns true if the download is complete.
   */
  isDone(): boolean {
    return this.getTransferredBytes() === this.contentLength
  }

  /**
   * Prints the current download stats. Once the download completes, this will print one
   * last line and then stop.
   */
  display(): void {
    if (this.displayedComplete) {
      return
    }

    const transferredBytes = this.segmentOffset + this.receivedBytes
    const percentage = (100 * (transferredBytes / this.contentLength)).toFixed(
      1
    )
    const elapsedTime = Date.now() - this.startTime
    const downloadSpeed = (
      transferredBytes /
      (1024 * 1024) /
      (elapsedTime / 1000)
    ).toFixed(1)

    core.info(
      `Received ${transferredBytes} of ${this.contentLength} (${percentage}%), ${downloadSpeed} MBs/sec`
    )

    if (this.isDone()) {
      this.displayedComplete = true
    }
  }

  /**
   * Returns a function used to handle TransferProgressEvents.
   */
  onProgress(): (progress: TransferProgressEvent) => void {
    return (progress: TransferProgressEvent) => {
      this.setReceivedBytes(progress.loadedBytes)
    }
  }

  /**
   * Starts the timer that displays the stats.
   *
   * @param delayInMs the delay between each write
   */
  startDisplayTimer(delayInMs = 1000): void {
    const displayCallback = (): void => {
      this.display()

      if (!this.isDone()) {
        this.timeoutHandle = setTimeout(displayCallback, delayInMs)
      }
    }

    this.timeoutHandle = setTimeout(displayCallback, delayInMs)
  }

  /**
   * Stops the timer that displays the stats. As this typically indicates the download
   * is complete, this will display one last line, unless the last line has already
   * been written.
   */
  stopDisplayTimer(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = undefined
    }

    this.display()
  }
}

/**
 * Download the cache using the Actions toolkit http-client
 *
 * @param archiveLocation the URL for the cache
 * @param archivePath the local path where the cache is saved
 */
export async function downloadCacheHttpClient(
  archiveLocation: string,
  archivePath: string
): Promise<void> {
  const writeStream = fs.createWriteStream(archivePath)
  const httpClient = new HttpClient('Warpbuilds/cache')
  const downloadResponse = await retryHttpClientResponse(
    'downloadCache',
    async () => httpClient.get(archiveLocation)
  )

  // Abort download if no traffic received over the socket.
  downloadResponse.message.socket.setTimeout(SocketTimeout, () => {
    downloadResponse.message.destroy()
    core.debug(`Aborting download, socket timed out after ${SocketTimeout} ms`)
  })

  await pipeResponseToStream(downloadResponse, writeStream)

  // Validate download size.
  const contentLengthHeader = downloadResponse.message.headers['content-length']

  if (contentLengthHeader) {
    const expectedLength = parseInt(contentLengthHeader)
    const actualLength = utils.getArchiveFileSizeInBytes(archivePath)

    if (actualLength !== expectedLength) {
      throw new Error(
        `Incomplete download. Expected file size: ${expectedLength}, actual file size: ${actualLength}`
      )
    }
  } else {
    core.debug('Unable to validate download, no Content-Length header')
  }
}

/**
 * Download the cache using the Actions toolkit http-client with multiple connections
 *
 * @param archiveLocation the URL for the cache
 * @param archivePath the local path where the cache is saved
 * @param connections number of connections to use
 */
export async function downloadCacheMultiConnection(
  archiveLocation: string,
  archivePath: string,
  connections: number
): Promise<void> {
  let fileHandle: fs.promises.FileHandle | null = null
  let downloadProgress: DownloadProgress | null = null
  try {
    fileHandle = await fs.promises.open(archivePath, 'w+')
    const httpClient = new HttpClient('Warpbuilds/cache')
    //Request 1 byte to get total content size
    const metadataResponse = await retryHttpClientResponse(
      'downloadCache',
      async () =>
        httpClient.get(archiveLocation, {
          Range: 'bytes=0-1'
        })
    )
    const contentRange = metadataResponse.message.headers['content-range']
    if (!contentRange) {
      console.log(await metadataResponse.readBody())
      throw new Error('Range request not supported by server')
    }
    const match = RegExp(/bytes \d+-\d+\/(\d+)/).exec(contentRange)
    if (!match) {
      throw new Error(
        'Content-Range header in server response not in correct format'
      )
    }
    const totalLength = parseInt(match[1])
    await fileHandle.truncate(totalLength)
    await fileHandle.sync()
    downloadProgress = new DownloadProgress(totalLength)
    downloadProgress.startDisplayTimer()
    const segmentSize = Math.ceil(totalLength / connections)
    const promises: Promise<void>[] = []
    for (let i = 0; i < connections; i++) {
      promises.push(
        (async () => {
          const rangeStart = i * segmentSize
          const rangeEnd = Math.min((i + 1) * segmentSize - 1, totalLength - 1)
          const downloadResponse = await retryHttpClientResponse(
            'downloadCache',
            async () =>
              httpClient.get(archiveLocation, {
                Range: `bytes=${rangeStart}-${rangeEnd}`
              })
          )

          const writeStream = fs.createWriteStream(archiveLocation, {
            fd: fileHandle.fd,
            autoClose: false,
            start: rangeStart
          })
          await pipeResponseToStream(
            downloadResponse,
            writeStream,
            downloadProgress
          )
        })()
      )
    }
    await Promise.all(promises)
  } finally {
    downloadProgress?.stopDisplayTimer()
    await fileHandle?.close()
  }
}

/**
 * Download cache in multipart using the Gcloud SDK
 *
 * @param archiveLocation the URL for the cache
 */
export async function downloadCacheMultipartGCP(
  storage: Storage,
  archiveLocation: string,
  archivePath: string
) {
  try {
    const {bucketName, objectName} =
      utils.retrieveGCSBucketAndObjectName(archiveLocation)

    const transferManager = new TransferManager(storage.bucket(bucketName))
    await transferManager.downloadFileInChunks(objectName, {
      destination: archivePath,
      noReturnData: true,
      validation: 'crc32c'
    })
  } catch (error) {
    core.debug(`Failed to download cache: ${error}`)
    throw error
  }
}

export async function downloadCacheGCP(
  storage: Storage,
  archiveLocation: string,
  archivePath: string
) {
  try {
    const timeoutDuration = 300000 // 5 minutes

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Download timed out')), timeoutDuration)
    )

    const {bucketName, objectName} =
      utils.retrieveGCSBucketAndObjectName(archiveLocation)

    const downloadPromise = storage
      .bucket(bucketName)
      .file(objectName)
      .download({
        destination: archivePath,
        validation: 'crc32c'
      })

    try {
      await Promise.race([downloadPromise, timeoutPromise])
      core.debug(
        `Download completed for bucket: ${bucketName}, object: ${objectName}`
      )
    } catch (error) {
      core.debug(`Failed to download cache: ${error}`)
      throw error
    }
  } catch (error) {
    core.debug(`Failed to download cache: ${error}`)
    throw error
  }
}

/**
 * Download the cache to a provider writable stream using GCloud SDK
 *
 * @param archiveLocation the URL for the cache
 */
export function downloadCacheStreamingGCP(
  storage: Storage,
  archiveLocation: string
): NodeJS.ReadableStream | undefined {
  try {
    // The archiveLocation for GCP will be in the format of gs://<bucket-name>/<object-name>
    const {bucketName, objectName} =
      utils.retrieveGCSBucketAndObjectName(archiveLocation)

    storage
      .bucket(bucketName)
      .file(objectName)
      .getMetadata()
      .then(data => {
        core.info(`File size: ${data[0]?.size} bytes`)
      })

    return storage.bucket(bucketName).file(objectName).createReadStream()
  } catch (error) {
    core.debug(`Failed to download cache: ${error}`)
    throw error
  }
}

export function getDownloadCommandPipeForWget(
  url: string
): ChildProcessWithoutNullStreams {
  return spawn('wget', ['-qO', '-', url])
}

// Newer download tech

/**
 * Download the cache using the Actions toolkit http-client concurrently
 *
 * @param archiveLocation the URL for the cache
 * @param archivePath the local path where the cache is saved
 */
export async function downloadCacheHttpClientConcurrent(
  archiveLocation: string,
  archivePath: fs.PathLike,
  options: DownloadOptions
): Promise<void> {
  const archiveDescriptor = await fs.promises.open(archivePath, 'w')
  const httpClient = new HttpClient('Warpbuilds/cache', undefined, {
    socketTimeout: options.timeoutInMs,
    keepAlive: true
  })
  try {
    // Use Range request to get total file size (works with PresignGetObject URLs)
    const res = await retryHttpClientResponse(
      'downloadCacheMetadata',
      async () => await httpClient.get(archiveLocation, {Range: 'bytes=0-0'})
    )

    const contentRange = res.message.headers['content-range']
    if (!contentRange) {
      throw new Error(
        'Content-Range header not found - server may not support range requests'
      )
    }

    // Parse "bytes 0-0/12345" to get total length (12345)
    const match = contentRange.match(/bytes \d+-\d+\/(\d+)/)
    const lengthHeader = match?.[1]

    if (!lengthHeader) {
      throw new Error(
        'Could not parse total file size from Content-Range header'
      )
    }

    const length = parseInt(lengthHeader)
    if (Number.isNaN(length)) {
      throw new Error(`Could not interpret Content-Length: ${length}`)
    }

    const downloads: {
      offset: number
      promiseGetter: () => Promise<DownloadSegment>
    }[] = []
    const blockSize = 4 * 1024 * 1024

    for (let offset = 0; offset < length; offset += blockSize) {
      const count = Math.min(blockSize, length - offset)
      downloads.push({
        offset,
        promiseGetter: async () => {
          return await downloadSegmentRetry(
            httpClient,
            archiveLocation,
            offset,
            count
          )
        }
      })
    }

    // reverse to use .pop instead of .shift
    downloads.reverse()
    let actives = 0
    let bytesDownloaded = 0
    const progress = new DownloadProgress(length)
    progress.startDisplayTimer()
    const progressFn = progress.onProgress()

    const activeDownloads: {[offset: number]: Promise<DownloadSegment>} = []
    let nextDownload:
      | {offset: number; promiseGetter: () => Promise<DownloadSegment>}
      | undefined

    const waitAndWrite: () => Promise<void> = async () => {
      const segment = await Promise.race(Object.values(activeDownloads))
      await archiveDescriptor.write(
        segment.buffer,
        0,
        segment.count,
        segment.offset
      )
      actives--
      delete activeDownloads[segment.offset]
      bytesDownloaded += segment.count
      progressFn({loadedBytes: bytesDownloaded})
    }

    while ((nextDownload = downloads.pop())) {
      activeDownloads[nextDownload.offset] = nextDownload.promiseGetter()
      actives++

      if (actives >= (options.downloadConcurrency ?? 10)) {
        await waitAndWrite()
      }
    }

    while (actives > 0) {
      await waitAndWrite()
    }

    progress.stopDisplayTimer()
  } finally {
    httpClient.dispose()
    await archiveDescriptor.close()
  }
}

async function downloadSegmentRetry(
  httpClient: HttpClient,
  archiveLocation: string,
  offset: number,
  count: number
): Promise<DownloadSegment> {
  const retries = 5
  let failures = 0

  while (true) {
    try {
      const timeout = 30000
      const result = await promiseWithTimeout(
        timeout,
        downloadSegment(httpClient, archiveLocation, offset, count)
      )
      if (typeof result === 'string') {
        throw new Error('downloadSegmentRetry failed due to timeout')
      }

      return result
    } catch (err) {
      if (failures >= retries) {
        throw err
      }

      failures++
    }
  }
}

async function downloadSegment(
  httpClient: HttpClient,
  archiveLocation: string,
  offset: number,
  count: number
): Promise<DownloadSegment> {
  const partRes = await retryHttpClientResponse(
    'downloadCachePart',
    async () =>
      await httpClient.get(archiveLocation, {
        Range: `bytes=${offset}-${offset + count - 1}`
      })
  )

  if (!partRes.readBodyBuffer) {
    throw new Error('Expected HttpClientResponse to implement readBodyBuffer')
  }

  return {
    offset,
    count,
    buffer: await partRes.readBodyBuffer()
  }
}

interface DownloadSegment {
  offset: number
  count: number
  buffer: Buffer
}

const promiseWithTimeout = async <T>(
  timeoutMs: number,
  promise: Promise<T>
): Promise<T | string> => {
  let timeoutHandle: NodeJS.Timeout
  const timeoutPromise = new Promise<string>(resolve => {
    timeoutHandle = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).then(result => {
    clearTimeout(timeoutHandle)
    return result
  })
}
