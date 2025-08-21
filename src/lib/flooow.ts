import { logStuff } from '@/utils/log-stuff'
import { UAParser } from 'ua-parser-js'
import decodeVideo from './video-decoder'

type FlooowOptions = {
  src: string
  wrapper: Element | string
  debug?: boolean
  useWebCodec?: boolean
  onReady?: () => void
}

class Flooow {
  debug = false
  isSafari = false
  useWebCodec = true
  src!: string

  videoProgress = 0

  canvas!: HTMLCanvasElement
  context!: CanvasRenderingContext2D

  frames: Array<ImageBitmap> = []
  frameRate = 0

  video!: HTMLVideoElement
  wrapper!: Element

  onReady?: () => void

  constructor({ debug = false, src, useWebCodec = true, wrapper, onReady }: FlooowOptions) {
    // Make sure we have a DOM
    if (typeof document !== 'object') {
      logStuff('Flooow instance must be created in a DOM environment', true)
      return
    }

    // Check basic arguments
    if (!wrapper) {
      logStuff('"wrapper" must be a valid HTML Element', true)
      return
    }

    if (!src) {
      logStuff('"src" property must be set')
      return
    }

    // Strore the wrapper
    // if it a HTMLElement we store it directly
    if (wrapper instanceof Element) {
      this.wrapper = wrapper
    } else if (typeof wrapper === 'string') {
      // if it's a string we search for it in the DOM
      const wrapperElement = document.querySelector(wrapper)
      if (!wrapperElement) {
        logStuff('wrapper not found in the DOM', true)
        return
      }

      this.wrapper = wrapperElement
    }

    // Store options
    this.debug = debug
    this.onReady = onReady
    this.src = src
    this.useWebCodec = useWebCodec

    // Create a base video element to be displayed at the begenning
    this.video = document.createElement('video')
    this.video.classList.add('flooow-video')
    this.video.src = this.src
    this.video.controls = false
    this.video.autoplay = true
    this.video.loop = true
    this.video.muted = true
    this.video.playsInline = true
    this.video.preload = 'auto'
    this.video.tabIndex = 0

    this.video.load()
    this.video.pause()

    // Insert the video in the wrapper
    this.wrapper.appendChild(this.video)

    // Detect webkit (safari), because webkit requires special attention
    const ua = new UAParser()
    const browserEngine = ua.getEngine()

    this.isSafari = browserEngine.name === 'WebKit'
    if (debug && this.isSafari) logStuff('Safari browser detected')

    this.decodeVideo()
  }

  async decodeVideo() {
    if (this.debug) logStuff('Decoding video...')

    if (!this.useWebCodec) {
      if (this.debug) logStuff('Cannot perform video decode: "useWebCodec" disabled', false, true)

      return
    }

    if (!this.src) {
      if (this.debug) logStuff('Cannot perform video decode: no `src` found', true)

      return
    }

    try {
      await decodeVideo(
        this.src,
        (frame) => {
          this.frames.push(frame)
        },
        this.debug
      )
    } catch (error) {
      // eslint-disable-next-line no-console
      if (this.debug) console.error('Error encountered while decoding video', error)

      // Remove all decoded frames if a failure happens during decoding
      this.frames = []

      // Force a video reload when videoDecoder fails
      this.video.load()
    }

    // If no frames, something went wrong
    if (this.frames.length === 0) {
      if (this.debug) logStuff('No frames were received from webCodecs', true)

      if (this.onReady) this.onReady()
      return
    }

    // Calculate the frameRate based on number of frames and the duration
    this.frameRate = this.frames.length / this.video.duration
    if (this.debug) logStuff('Received ' + this.frames.length + ' frames')
    if (this.debug) logStuff('Frame rate: ' + this.frameRate + ' fps')

    if (this.onReady) this.onReady()
  }

  playVideoTo() {
    this.video.currentTime = this.videoProgress * this.video.duration
  }

  setVideoProgress(progress: number) {
    if (this.videoProgress === progress) return

    this.videoProgress = progress
    this.playVideoTo()
  }
}

export default Flooow
