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
  currentTime = 0
  targetTime = 0

  canvas!: HTMLCanvasElement
  context!: CanvasRenderingContext2D | null

  frames: Array<ImageBitmap> = []
  frameRate = 0

  video!: HTMLVideoElement
  wrapper!: Element

  transitionSpeed = 8 // How fast to transition between frames, in frames per second
  frameThreshold = 0.1 // When to stop the video animation, in seconds
  transitioningRaf: number | null = null

  onReady?: () => void
  resize?: () => void

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

    // Add resize listener
    this.resize = () => {
      if (this.debug) messenger.info('Resizing video')
      this.updateCanvasSize()
      this.paintFrame(Math.floor(this.currentTime * this.frameRate))
    }

    window.addEventListener('resize', this.resize)
    this.video.addEventListener('progress', this.resize)

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
    if (this.debug) messenger.info('Transitioning targetTime:', this.targetTime, 'currentTime:', this.currentTime)

    const diff = this.targetTime - this.currentTime
    const isForwardTransition = diff > 0

    type TickOptions = {
      startCurrentTime: number
      startTimestamp: number
      timestamp: number
    }

    const tick = ({ startCurrentTime, startTimestamp }: TickOptions) => {
      // if frameThreshold is too low to catch condition Math.abs(this.targetTime - this.currentTime) < this.frameThreshold
      const hasPassedThreshold = isForwardTransition
        ? this.currentTime >= this.targetTime
        : this.currentTime <= this.targetTime

      // If we are already close enough to our target, pause the video and return.
      // This is the base case of the recursive function
      if (
        isNaN(this.targetTime) ||
        // If the currentTime is already close enough to the targetTime
        Math.abs(this.targetTime - this.currentTime) < this.frameThreshold ||
        hasPassedThreshold
      ) {
        this.video.pause()
        if (this.transitioningRaf) {
          cancelAnimationFrame(this.transitioningRaf)
          this.transitioningRaf = null
        }
        return
      }

      // Make sure we don't go out of time bounds
      if (this.targetTime > this.video.duration) this.targetTime = this.video.duration
      if (this.targetTime < 0) this.targetTime = 0

      // How far forward we need to transition
      const transitionForward = this.targetTime - this.currentTime

      if (this.canvas) {
        this.currentTime = this.targetTime
        this.paintFrame(Math.floor(this.currentTime * this.frameRate))
      } else if (this.isSafari || !isForwardTransition) {
        // We can't use a negative playbackRate, so if the video needs to go backwards,
        // We have to use the inefficient method of modifying currentTime rapidly to
        // get an effect.
        this.video.pause()
        this.currentTime = this.targetTime
        this.video.currentTime = this.currentTime
      } else {
        // Otherwise, we play the video and adjust the playbackRate to get a smoother
        // animation effect.
        const playbackRate = Math.max(Math.min(transitionForward * 4, this.transitionSpeed, 16), 1)
        if (this.debug) messenger.info('ScrollyVideo playbackRate:', playbackRate)
        if (!isNaN(playbackRate)) {
          this.video.playbackRate = playbackRate
          this.video.play()
        }
        // Set the currentTime to the video's currentTime
        this.currentTime = this.video.currentTime
      }

      // Recursively calls ourselves until the animation is done.
      if (typeof requestAnimationFrame === 'function') {
        this.transitioningRaf = requestAnimationFrame((currentTimestamp) =>
          tick({
            startCurrentTime,
            startTimestamp,
            timestamp: currentTimestamp
          })
        )
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      this.transitioningRaf = requestAnimationFrame((startTimestamp) => {
        tick({
          startCurrentTime: this.currentTime,
          startTimestamp,
          timestamp: startTimestamp
        })
      })
    }
  }

  setVideoProgress(progress: number) {
    if (this.videoProgress === progress) return

    this.videoProgress = progress
    this.currentTime = this.video.currentTime
    this.targetTime = this.videoProgress * this.video.duration
    this.playVideoTo()
  }

  updateCanvasSize() {
    if (!this.canvas || !this.wrapper) return

    const wrapperRect = this.wrapper.getBoundingClientRect()

    this.canvas.width = wrapperRect.width
    this.canvas.height = wrapperRect.height
  }

  destroy() {
    if (this.debug) messenger.info('Destroying ScrollyVideo')

    if (this.resize) window.removeEventListener('resize', this.resize)

    // Clear component
    if (this.wrapper) this.wrapper.innerHTML = ''
  }
}

export default Flooow
