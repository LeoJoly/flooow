/* eslint-disable @typescript-eslint/no-explicit-any */
import * as MP4Box from 'mp4box'
import { logStuff } from '@/utils/log-stuff'

/**
 * A utility class for writing binary data to a Uint8Array buffer with specific size
 */
class Writer {
  data: Uint8Array
  idx: number
  size: number

  constructor(size: number) {
    this.data = new Uint8Array(size)
    this.idx = 0
    this.size = size
  }

  /**
   * Returns the written data as a Uint8Array slice
   * @returns A slice of the internal buffer containing only the written data
   * @throws Error if the amount of written data doesn't match the allocated size
   */
  getData() {
    if (this.idx !== this.size) throw new Error('Mismatch between size reserved and sized used')
    return this.data.slice(0, this.idx)
  }

  /**
   * Writes an 8-bit unsigned integer to the buffer
   * @param value The number to write (0-255)
   */
  writeUint8(value: number) {
    this.data.set([value], this.idx)
    this.idx += 1
  }

  /**
   * Writes a 16-bit unsigned integer to the buffer in little-endian format
   * @param value The number to write (0-65535)
   */
  writeUint16(value: number) {
    const arr = new Uint16Array(1)
    arr[0] = value
    const buffer = new Uint8Array(arr.buffer)
    this.data.set([buffer[1], buffer[0]], this.idx)
    this.idx += 2
  }

  /**
   * Writes a Uint8Array to the buffer
   * @param value The array to write
   */
  writeUint8Array(value: Uint8Array) {
    this.data.set(value, this.idx)
    this.idx += value.length
  }
}

/**
 * Extracts and formats the AVC configuration data from an MP4 AVCC box
 * @param avccBox The AVCC box containing H.264 configuration data
 * @returns A Uint8Array containing the formatted extradata buffer with SPS and PPS NAL units
 */
const getExtradata = (avccBox: any): Uint8Array => {
  let i
  let size = 7

  // Calculate size needed for SPS NAL units
  for (i = 0; i < avccBox.SPS.length; i += 1) {
    size += 2 + avccBox.SPS[i].length
  }

  // Calculate size needed for PPS NAL units
  for (i = 0; i < avccBox.PPS.length; i += 1) {
    size += 2 + avccBox.PPS[i].length
  }

  const writer = new Writer(size)

  // Write AVC configuration headers
  writer.writeUint8(avccBox.configurationVersion)
  writer.writeUint8(avccBox.AVCProfileIndication)
  writer.writeUint8(avccBox.profile_compatibility)
  writer.writeUint8(avccBox.AVCLevelIndication)
  writer.writeUint8(avccBox.lengthSizeMinusOne + (63 << 2))

  // Write SPS NAL units
  writer.writeUint8(avccBox.nb_SPS_nalus + (7 << 5))
  for (i = 0; i < avccBox.SPS.length; i += 1) {
    writer.writeUint16(avccBox.SPS[i].length)
    writer.writeUint8Array(avccBox.SPS[i].data)
  }

  // Write PPS NAL units
  writer.writeUint8(avccBox.nb_PPS_nalus)
  for (i = 0; i < avccBox.PPS.length; i += 1) {
    writer.writeUint16(avccBox.PPS[i].length)
    writer.writeUint8Array(avccBox.PPS[i].data)
  }

  return writer.getData()
}

/**
 * Decodes an MP4 video file and emits frames as ImageBitmap objects
 * @param src The URL of the MP4 video file to decode
 * @param emitFrame Callback function that receives decoded frames as ImageBitmap objects
 * @param debug Whether to output debug logging information
 * @returns Promise that resolves when decoding is complete
 */
const decodeVideo = (src: string, emitFrame: (frame: ImageBitmap) => void, debug: boolean): Promise<unknown> =>
  new Promise<void>((resolve, reject) => {
    if (debug) logStuff('Decoding video from ' + src)

    try {
      // Create MP4Box file parser instance
      const mp4boxfile = MP4Box.createFile()

      let codec

      // Initialize video decoder with output and error handlers
      const decoder = new VideoDecoder({
        // Handle decoded video frames
        output: (frame) => {
          createImageBitmap(frame, { resizeQuality: 'low' }).then((bitmap) => {
            emitFrame(bitmap)
            frame.close()

            // Clean up decoder when queue is empty
            if (decoder.decodeQueueSize <= 0) {
              setTimeout(() => {
                if (decoder.state !== 'closed') {
                  decoder.close()
                  resolve()
                }
              }, 500)
            }
          })
        },

        // Handle decoder errors
        error: (e) => {
          console.error(e)
          reject(e)
        }
      })

      // Handle MP4Box ready event
      mp4boxfile.onReady = (info) => {
        if (info && info.videoTracks && info.videoTracks[0]) {
          ;[{ codec }] = info.videoTracks
          if (debug) logStuff('Video with codec: ' + codec)

          // Extract codec configuration data
          const avccBox = (mp4boxfile.moov.traks[0].mdia.minf.stbl.stsd.entries[0] as any).avcC
          const extradata = getExtradata(avccBox)

          decoder.configure({ codec, description: extradata })

          // Start extracting video samples
          mp4boxfile.setExtractionOptions(info.videoTracks[0].id)
          mp4boxfile.start()
        } else reject(new Error('URL provided is not a valid mp4 video file.'))
      }

      // Process video samples
      mp4boxfile.onSamples = (_, __, samples) => {
        // Decode each sample
        for (let i = 0; i < samples.length; i += 1) {
          const sample = samples[i]
          const type = sample.is_sync ? 'key' : 'delta'

          // Create video chunk from sample
          const chunk = new EncodedVideoChunk({
            type,
            timestamp: sample.cts,
            duration: sample.duration,
            data: sample.data!
          })

          decoder.decode(chunk)
        }
      }

      // Fetch and process video data
      fetch(src).then((res) => {
        // Set up stream reader
        const reader = res.body?.getReader()
        let offset = 0

        // Process incoming buffer chunks
        function appendBuffers({ done, value }: any): any {
          // Handle end of stream
          if (done) {
            mp4boxfile.flush()
            return null
          }

          // Append buffer to MP4Box file
          const buf = value.buffer
          buf.fileStart = offset
          offset += buf.byteLength
          mp4boxfile.appendBuffer(buf)

          // Continue reading stream
          return reader?.read().then(appendBuffers)
        }

        // Start reading stream
        return reader?.read().then(appendBuffers)
      })
    } catch (e) {
      reject(e)
    }
  })

/**
 * Decodes an MP4 video file into frames using WebCodecs if available
 * @param src The URL of the MP4 video file to decode
 * @param emitFrame Callback function that receives decoded frames as ImageBitmap objects
 * @param debug Whether to output debug logging information
 * @returns Promise that resolves when decoding is complete, or immediately if WebCodecs is not supported
 */
export default (src: string, emitFrame: (frame: ImageBitmap) => void, debug: boolean) => {
  // Check if WebCodecs API is available
  if (typeof VideoDecoder === 'function' && typeof EncodedVideoChunk === 'function') {
    if (debug) logStuff('WebCodecs is natively supported, using native version...')
    return decodeVideo(src, emitFrame, debug)
  }

  // Fallback when WebCodecs is not supported
  if (debug) logStuff('WebCodecs is not available in this browser.')
  return Promise.resolve()
}
