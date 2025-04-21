import {CompressionMethod} from './constants'
import {TypedResponse} from '@actions/http-client/lib/interfaces'
import {HttpClientError} from '@actions/http-client'

export interface ITypedResponseWithError<T> extends TypedResponse<T> {
  error?: HttpClientError
}

export interface ArtifactCacheEntry {
  cacheKey?: string
  scope?: string
  cacheVersion?: string
  creationTime?: string
  archiveLocation?: string
}

export interface ArtifactCacheList {
  totalCount: number
  artifactCaches?: ArtifactCacheEntry[]
}

export interface UploadPart {
  partNumber: number,
  eTag: string
}

export interface CommitCacheRequest {
  key: string
  version: string
  uploadId: string
  cacheSize: number
  archiveTimeMs: number
  uploadTimeMs: number
  parts: UploadPart[]
}

export interface ReserveCacheRequest {
  key: string
  version: string
  cacheSize: number
  chunks: number
}

export interface ReserveCacheResponse {
  uploadId: string,
  urls: string[]
}

export interface InternalCacheOptions {
  compressionMethod?: CompressionMethod
  enableCrossOsArchive?: boolean
  cacheSize?: number
  uploadConcurrency?: number
}

export interface ArchiveTool {
  path: string
  type: string
}
