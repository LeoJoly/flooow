import messenger from '@/utils/messenger'
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
  context!: CanvasRenderingContext2D | null

  frames: Array<ImageBitmap> = []
  frameRate = 0

  video!: HTMLVideoElement
  wrapper!: Element

  onReady?: () => void

  constructor({ debug = false, src, useWebCodec = true, wrapper, onReady }: FlooowOptions) {
    // Make sure we have a DOM
    if (typeof document !== 'object') {
      messenger.error('Flooow instance must be created in a DOM environment')
      return
    }

    // Check basic arguments
    if (!wrapper) {
      messenger.error('"wrapper" must be a valid HTML Element')
      return
    }

    if (!src) {
      messenger.error('"src" property must be set')
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
        messenger.error('wrapper not found in the DOM')
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
    if (debug && this.isSafari) messenger.info('Safari browser detected')

    this.decodeVideo()
  }

  async decodeVideo() {
    if (this.debug) messenger.info('Decoding video...')

    if (!this.useWebCodec) {
      if (this.debug) messenger.warn('Cannot perform video decode: "useWebCodec" disabled')

      return
    }

    if (!this.src) {
      if (this.debug) messenger.error('Cannot perform video decode: no `src` found')

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
      if (this.debug) messenger.error('No frames were received from webCodecs')

      if (this.onReady) this.onReady()
      return
    }

    // Calculate the frameRate based on number of frames and the duration
    this.frameRate = this.frames.length / this.video.duration
    if (this.debug) messenger.info('Received', this.frames.length, 'frames')
    if (this.debug) messenger.info('Frame rate:', this.frameRate, 'fps')

    this.canvas = document.createElement('canvas')
    this.canvas.classList.add('flooow-canvas')
    this.updateCanvasSize()
    this.context = this.canvas.getContext('2d')

    // Hide the video and add the canvas to the container
    this.video.style.display = 'none'
    this.wrapper.appendChild(this.canvas)

    // Paint our first frame
    this.paintFrame(0)

    if (this.onReady) this.onReady()
  }

  paintFrame(frameIndex: number) {
    const frame = this.frames[frameIndex]

    if (!frame || !this.context) return

    if (this.debug) messenger.info('Painting frame', frameIndex)

    const { width: canvasWidth, height: canvasHeight } = this.canvas
    const { width: frameWidth, height: frameHeight } = frame

    // Compare the frame size to the canvas size
    // If the frame is bigger, we scale it down
    // If the frame is smaller, we scale it up
    const scaleX = canvasWidth / frameWidth
    const scaleY = canvasHeight / frameHeight

    // Define a single scale to keep image proportions
    const scale = Math.max(scaleX, scaleY)

    // Clear the canvas
    this.context.clearRect(0, 0, canvasWidth, canvasHeight)

    // Center and fit the frame in the canvas
    this.context.drawImage(
      frame,
      (canvasWidth - frameWidth * scale) / 2,
      (canvasHeight - frameHeight * scale) / 2,
      frameWidth * scale,
      frameHeight * scale
    )
  }

  playVideoTo() {
    this.video.currentTime = this.videoProgress * this.video.duration
  }

  setVideoProgress(progress: number) {
    if (this.videoProgress === progress) return

    this.videoProgress = progress
    this.playVideoTo()
  }

  updateCanvasSize() {
    if (!this.canvas || !this.wrapper) return

    const wrapperRect = this.wrapper.getBoundingClientRect()

    this.canvas.width = wrapperRect.width
    this.canvas.height = wrapperRect.height
  }
}

export default Flooow
