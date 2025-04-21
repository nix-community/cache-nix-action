import * as core from '@actions/core'
import { HttpClient, HttpClientResponse } from '@actions/http-client'
import * as buffer from 'buffer'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as stream from 'stream'
import * as util from 'util'
import * as utils from './cacheUtils'
import { SocketTimeout } from './constants'
import { DownloadOptions } from '../options'
import { retryHttpClientResponse } from './requestUtils'
import { exec } from '@actions/exec'


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
  await pipeline(response.message, new stream.Transform({
    transform(chunk, encoding, callback) {
      if (progress) {
        progress.setReceivedBytes(progress.getTransferredBytes() + chunk.length)
      }
      this.push(chunk)
      callback()
    }
  }), output)
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
 * Download the cache using the Actions toolkit http-client with multiple connections
 *
 * @param archiveLocation the URL for the cache
 * @param archivePath the local path where the cache is saved
 * @param connections number of connections to use
 */
export async function downloadCachMultiConnection(
  archiveLocation: string,
  archivePath: string,
  connections: number
): Promise<void> {
  let fileHandle
  let downloadProgress
  try {
    fileHandle = await fsPromises.open(archivePath, 'w+')
    const httpClient = new HttpClient('actions/cache')
    //Request 1 byte to get total content size
    const metadataResponse = await retryHttpClientResponse(
      'downloadCache',
      async () => httpClient.get(archiveLocation, {
        Range: 'bytes=0-1'
      })
    )
    const contentRange = metadataResponse.message.headers['content-range']
    if (!contentRange) {
      console.log(await metadataResponse.readBody())
      throw new Error("Range request not supported by server")
    }
    const match = contentRange?.match(/bytes \d+-\d+\/(\d+)/)
    if (!match) {
      throw new Error("Content-Range header in server response not in correct format")
    }
    const totalLength = parseInt(match[1])
    await fileHandle.truncate(totalLength)
    await fileHandle.sync()
    downloadProgress = new DownloadProgress(totalLength)
    downloadProgress.startDisplayTimer()
    const segmentSize = Math.ceil(totalLength / connections)
    const promises: Promise<void>[] = []
    for (let i = 0; i < connections; i++) {
      promises.push((async () => {
        const rangeStart = i * segmentSize
        const rangeEnd = Math.min((i + 1) * segmentSize - 1, totalLength - 1)
        const downloadResponse = await retryHttpClientResponse(
          'downloadCache',
          async () => httpClient.get(archiveLocation, {
            Range: `bytes=${rangeStart}-${rangeEnd}`
          })
        )
        const writeStream = fs.createWriteStream(archiveLocation, { fd: fileHandle.fd, autoClose: false, start: rangeStart })
        await pipeResponseToStream(downloadResponse, writeStream, downloadProgress)
      })())
    }
    await Promise.all(promises)
  } finally {
    downloadProgress?.stopDisplayTimer()
    await fileHandle?.close()
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
  const httpClient = new HttpClient('actions/cache')
  const downloadResponse = await retryHttpClientResponse(
    'downloadCache',
    async () => httpClient.get(archiveLocation)
  )

  const contentLengthHeader = downloadResponse.message.headers['content-length']
  let downloadProgress: DownloadProgress | undefined
  if (contentLengthHeader) {
    downloadProgress = new DownloadProgress(parseInt(contentLengthHeader))
  }

  // Abort download if no traffic received over the socket.
  downloadResponse.message.socket.setTimeout(SocketTimeout, () => {
    downloadResponse.message.destroy()
    core.debug(`Aborting download, socket timed out after ${SocketTimeout} ms`)
  })

  try {
    downloadProgress?.startDisplayTimer()
    await pipeResponseToStream(downloadResponse, writeStream, downloadProgress)
  } finally {
    downloadProgress?.startDisplayTimer()
  }

  // Validate download size.
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
