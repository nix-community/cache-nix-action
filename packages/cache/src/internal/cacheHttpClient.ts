import * as core from '@actions/core'
import { HttpClient } from '@actions/http-client'
import { BearerCredentialHandler } from '@actions/http-client/lib/auth'
import {
  RequestOptions,
  TypedResponse
} from '@actions/http-client/lib/interfaces'
import * as crypto from 'crypto'
import * as fs from 'fs'
import { URL } from 'url'

import * as utils from './cacheUtils'
import { CompressionMethod } from './constants'
import {
  ArtifactCacheEntry,
  InternalCacheOptions,
  CommitCacheRequest,
  ReserveCacheRequest,
  ReserveCacheResponse,
  ITypedResponseWithError,
  ArtifactCacheList,
  UploadPart
} from './contracts'
import { downloadCachMultiConnection, downloadCacheHttpClient } from './downloadUtils'
import {
  DownloadOptions,
  UploadOptions,
  getDownloadOptions,
  getUploadOptions
} from '../options'
import {
  isSuccessStatusCode,
  retryHttpClientResponse,
  retryTypedResponse
} from './requestUtils'
import { LIB_VERSION } from './version'

const versionSalt = '1.0'

function getCacheApiUrl(resource: string): string {
  const baseUrl: string = process.env['BUILDJET_CACHE_URL'] || 'https://cache-api.buildjet.com/'
  if (!baseUrl) {
    throw new Error('Cache Service Url not found, unable to restore cache.')
  }

  const url = `${baseUrl}_apis/artifactcache/${resource}`
  core.debug(`Resource Url: ${url}`)
  return url
}

function createAcceptHeader(type: string, apiVersion: string): string {
  return `${type};api-version=${apiVersion}`
}

function getRequestOptions(): RequestOptions {
  const requestOptions: RequestOptions = {
    headers: {
      Accept: createAcceptHeader('application/json', '6.0-preview.1'),
      'Action-Cache-Url': process.env['ACTIONS_CACHE_URL'] || '',
      'Github-Repository': process.env['GITHUB_REPOSITORY'] || '',
      'Github-Repository-Id': process.env['GITHUB_REPOSITORY_ID'] || '',
      'Github-Repository-Owner': process.env['GITHUB_REPOSITORY_OWNER'] || '',
      'Github-Repository-Owner-Id': process.env['GITHUB_REPOSITORY_OWNER_ID'] || ''
    }
  }

  return requestOptions
}


function createHttpClient(): HttpClient {
  const token = process.env['ACTIONS_RUNTIME_TOKEN'] || ''
  const actionRepository = process.env['GITHUB_ACTION_REPOSITORY'] || ''
  const runnerArch = process.env['RUNNER_ARCH'] || ''
  const runnerOs = process.env['RUNNER_OS'] || ''
  const bearerCredentialHandler = new BearerCredentialHandler(token)

  return new HttpClient(
    `BuildJet-cache/${LIB_VERSION} (${runnerOs}; ${runnerArch}) ${actionRepository}`,
    [bearerCredentialHandler],
    getRequestOptions()
  )
}

export function getCacheVersion(
  paths: string[],
  compressionMethod?: CompressionMethod,
  enableCrossOsArchive = false
): string {
  // don't pass changes upstream
  const components = paths.slice()

  // Add compression method to cache version to restore
  // compressed cache as per compression method
  if (compressionMethod) {
    components.push(compressionMethod)
  }

  // Only check for windows platforms if enableCrossOsArchive is false
  if (process.platform === 'win32' && !enableCrossOsArchive) {
    components.push('windows-only')
  }

  // Add salt to cache version to support breaking changes in cache entry
  components.push(versionSalt)

  return crypto.createHash('sha256').update(components.join('|')).digest('hex')
}

export async function getCacheEntry(
  keys: string[],
  paths: string[],
  options?: InternalCacheOptions
): Promise<ArtifactCacheEntry | null> {
  const httpClient = createHttpClient()
  const version = getCacheVersion(
    paths,
    options?.compressionMethod,
    options?.enableCrossOsArchive
  )
  const resource = `cache?keys=${encodeURIComponent(
    keys.join(',')
  )}&version=${version}`

  const response = await retryTypedResponse('getCacheEntry', async () =>
    httpClient.getJson<ArtifactCacheEntry>(getCacheApiUrl(resource))
  )
  // Cache not found
  if (response.statusCode === 204) {
    // List cache for primary key only if cache miss occurs
    if (core.isDebug()) {
      await printCachesListForDiagnostics(keys[0], httpClient, version)
    }
    return null
  }
  if (!isSuccessStatusCode(response.statusCode)) {
    throw new Error(`Cache service responded with ${response.statusCode}`)
  }

  const cacheResult = response.result
  const cacheDownloadUrl = cacheResult?.archiveLocation
  if (!cacheDownloadUrl) {
    // Cache achiveLocation not found. This should never happen, and hence bail out.
    throw new Error('Cache not found.')
  }
  core.setSecret(cacheDownloadUrl)
  core.debug(`Cache Result:`)
  core.debug(JSON.stringify(cacheResult))
  return cacheResult
}

async function printCachesListForDiagnostics(
  key: string,
  httpClient: HttpClient,
  version: string
): Promise<void> {
  const resource = `caches?key=${encodeURIComponent(key)}`
  const response = await retryTypedResponse('listCache', async () =>
    httpClient.getJson<ArtifactCacheList>(getCacheApiUrl(resource))
  )
  if (response.statusCode === 200) {
    const cacheListResult = response.result
    const totalCount = cacheListResult?.totalCount
    if (totalCount && totalCount > 0) {
      core.debug(
        `No matching cache found for cache key '${key}', version '${version} and scope ${process.env['GITHUB_REF']}. There exist one or more cache(s) with similar key but they have different version or scope. See more info on cache matching here: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key \nOther caches with similar key:`
      )
      for (const cacheEntry of cacheListResult?.artifactCaches || []) {
        core.debug(
          `Cache Key: ${cacheEntry?.cacheKey}, Cache Version: ${cacheEntry?.cacheVersion}, Cache Scope: ${cacheEntry?.scope}, Cache Created: ${cacheEntry?.creationTime}`
        )
      }
    }
  }
}

export async function downloadCache(
  archiveLocation: string,
  archivePath: string,
  options?: DownloadOptions
): Promise<void> {
  const archiveUrl = new URL(archiveLocation)
  const downloadOptions = getDownloadOptions(options)
  if (process.env['PARALLEL_DOWNLOAD'] == 'false') {
    //Use parallel download as default unless diasbled
    await downloadCacheHttpClient(archiveLocation, archivePath)
  } else {
    await downloadCachMultiConnection(archiveLocation, archivePath, options?.downloadConcurrency ?? 8)
  }
}

export interface CacheRestoreReport {
  cacheKey: string,
  cacheVersion: string,
  scope: string,
  size: number,
  downloadConcurrency: number,
  downloadTimeMs: number,
  extractTimeMs: number
}

export async function reportCacheRestore(
  report: CacheRestoreReport
) {
  const httpClient = createHttpClient()
  const response = await retryTypedResponse('cacheRestoreReport', async () =>
    httpClient.postJson(getCacheApiUrl('cacheRestoreReport'), report)
  )
  if (!isSuccessStatusCode(response.statusCode)) {
    throw new Error(`Cache service responded with ${response.statusCode}`)
  }
}

// Reserve Cache
export async function reserveCache(
  key: string,
  version: string,
  options: InternalCacheOptions
): Promise<ITypedResponseWithError<ReserveCacheResponse>> {
  const httpClient = createHttpClient()
  const reserveCacheRequest: ReserveCacheRequest = {
    key,
    version,
    cacheSize: options.cacheSize!,
    chunks: options.uploadConcurrency ?? 4
  }
  const response = await retryTypedResponse('reserveCache', async () =>
    httpClient.postJson<ReserveCacheResponse>(
      getCacheApiUrl('caches'),
      reserveCacheRequest
    )
  )
  return response
}

function getContentRange(start: number, end: number): string {
  // Format: `bytes start-end/filesize
  // start and end are inclusive
  // filesize can be *
  // For a 200 byte chunk starting at byte 0:
  // Content-Range: bytes 0-199/*
  return `bytes ${start}-${end}/*`
}

async function uploadChunk(
  httpClient: HttpClient,
  resourceUrl: string,
  openStream: () => NodeJS.ReadableStream,
  start: number,
  end: number
): Promise<string> {
  core.debug(
    `Uploading chunk of size ${end -
    start +
    1} bytes at offset ${start} with content range: ${getContentRange(
      start,
      end
    )}`
  )
  const additionalHeaders = {
    'Content-Type': 'application/octet-stream',
    'Content-Length': end - start + 1
  }

  const uploadChunkResponse = await retryHttpClientResponse(
    `uploadChunk (start: ${start}, end: ${end})`,
    async () =>
      httpClient.sendStream(
        'PUT',
        resourceUrl,
        openStream(),
        additionalHeaders
      )
  )
  core.debug(JSON.stringify(uploadChunkResponse.message.headers));
  core.debug(JSON.stringify(await uploadChunkResponse.readBody()));
  if (!isSuccessStatusCode(uploadChunkResponse.message.statusCode)) {
    throw new Error(
      `Cache service responded with ${uploadChunkResponse.message.statusCode} during upload chunk.`
    )
  }
  return uploadChunkResponse.message.headers.etag!
}

async function uploadFile(
  httpClient: HttpClient,
  urls: string[],
  archivePath: string,
  options?: UploadOptions
): Promise<string[]> {
  // Upload Chunks
  const fileSize = utils.getArchiveFileSizeInBytes(archivePath)
  const fd = fs.openSync(archivePath, 'r')

  core.debug('Awaiting all uploads')
  let offset = 0

  const maxChunkSize = Math.ceil(fileSize / urls.length)
  try {
    const eTags = await Promise.all(
      urls.map(async (url) => {
        while (offset < fileSize) {
          const chunkSize = Math.min(fileSize - offset, maxChunkSize)
          const start = offset
          const end = offset + chunkSize - 1
          offset += chunkSize

          return await uploadChunk(
            httpClient,
            url,
            () =>
              fs
                .createReadStream(archivePath, {
                  fd,
                  start,
                  end,
                  autoClose: false
                })
                .on('error', error => {
                  throw new Error(
                    `Cache upload failed because file read failed with ${error.message}`
                  )
                }),
            start,
            end
          )
        }
      })
    )
    return eTags as string[];
  } finally {
    fs.closeSync(fd)
  }
}

export async function saveCache(
  key: string,
  version: string,
  uploadId: string,
  urls: string[],
  archivePath: string,
  archiveTimeMs: number,
  options?: UploadOptions
): Promise<void> {
  const httpClient = createHttpClient()

  core.debug('Upload cache')
  const uploadHttpClient = new HttpClient('actions/cache')
  const beforeUpload = Date.now()
  const eTags = await uploadFile(uploadHttpClient, urls, archivePath, options)
  const uploadTimeMs = Date.now() - beforeUpload
  // Commit Cache
  core.debug('Commiting cache')
  const cacheSize = utils.getArchiveFileSizeInBytes(archivePath)
  core.info(
    `Cache Size: ~${Math.round(cacheSize / (1024 * 1024))} MB (${cacheSize} B)`
  )
  let i = 1;
  const parts: UploadPart[] = eTags.map((eTag) => {
    const part: UploadPart = { partNumber: i++, eTag }
    return part
  })
  const commitCacheRequest: CommitCacheRequest = {
    key, version, uploadId, cacheSize, parts, uploadTimeMs, archiveTimeMs
  }
  const commitCacheResponse = await retryTypedResponse('commitCache', async () =>
    httpClient.postJson<null>(
      getCacheApiUrl(`commitCache`),
      commitCacheRequest
    )
  )
  if (!isSuccessStatusCode(commitCacheResponse.statusCode)) {
    throw new Error(
      `Cache service responded with ${commitCacheResponse.statusCode} during commit cache.`
    )
  }

  core.info('Cache saved successfully')
}

export async function deleteCache(keys: string[]) {
  const httpClient = createHttpClient()
  const resource = `cache?keys=${encodeURIComponent(
    keys.join(',')
  )}`

  const response = await retryHttpClientResponse('deleteCache', async () =>
    httpClient.del(getCacheApiUrl(resource))
  )

  if (!isSuccessStatusCode(response.message.statusCode)) {
    throw new Error(`Cache service responded with ${response.message.statusCode}`)
  }

}