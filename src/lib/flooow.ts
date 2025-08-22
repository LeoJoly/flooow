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

type TickOptions = {
  startCurrentTime: number
  startTimestamp: number
  timestamp: number
}

/**
 * A class for handling smooth video playback and transitions with frame-by-frame control.
 * Supports both standard video playback and WebCodec-based frame rendering.
 * @class
 * @param {FlooowOptions} options - Configuration options
 * @param {string} options.src - Source URL of the video file
 * @param {Element|string} options.wrapper - DOM element or selector to contain the video
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {boolean} [options.useWebCodec=true] - Use WebCodec API for frame extraction
 * @param {Function} [options.onReady] - Callback function executed when video is ready
 */
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

  transitionSpeed = 8
  frameThreshold = 0.1
  transitioningRaf: number | null = null

  onReady?: () => void
  resize?: () => void

  constructor({ debug = false, src, useWebCodec = true, wrapper, onReady }: FlooowOptions) {
    // Check if code is running in browser environment
    if (typeof document !== 'object') {
      messenger.error('Flooow instance must be created in a DOM environment')
      return
    }

    // Validate wrapper element parameter
    if (!wrapper) {
      messenger.error('"wrapper" must be a valid HTML Element')
      return
    }

    // Validate source URL parameter
    if (!src) {
      messenger.error('"src" property must be set')
      return
    }

    // Set wrapper element from parameter or query selector
    if (wrapper instanceof Element) {
      this.wrapper = wrapper
    } else if (typeof wrapper === 'string') {
      const wrapperElement = document.querySelector(wrapper)
      if (!wrapperElement) {
        messenger.error('wrapper not found in the DOM')
        return
      }

      this.wrapper = wrapperElement
    }

    // Initialize instance properties
    this.debug = debug
    this.onReady = onReady
    this.src = src
    this.useWebCodec = useWebCodec

    // Create and configure video element
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

    // Load video and pause initially
    this.video.load()
    this.video.pause()

    // Display video as first solution
    this.wrapper.appendChild(this.video)

    // Detect Safari browser
    const ua = new UAParser()
    const browserEngine = ua.getEngine()

    this.isSafari = browserEngine.name === 'WebKit'
    if (debug && this.isSafari) messenger.info('Safari browser detected')

    // Define resize handler for video and canvas
    this.resize = () => {
      if (this.debug) messenger.info('Resizing video')
      this.updateCanvasSize()
      this.paintFrame(Math.floor(this.currentTime * this.frameRate))
    }

    window.addEventListener('resize', this.resize)
    this.video.addEventListener('progress', this.resize)

    // Start video decoding process
    this.decodeVideo()
  }

  /**
   * Decodes the video source into individual frames using WebCodec.
   * Stores decoded frames in memory for smooth playback and transitions.
   * Falls back to standard video element if WebCodec is disabled or fails.
   * @private
   */
  private async decodeVideo() {
    if (this.debug) messenger.info('Decoding video...')

    // Check if WebCodec is enabled
    if (!this.useWebCodec) {
      if (this.debug) messenger.warn('Cannot perform video decode: "useWebCodec" disabled')

      return
    }

    // Check if source URL is set
    if (!this.src) {
      if (this.debug) messenger.error('Cannot perform video decode: no `src` found')

      return
    }

    try {
      // Decode video frames using WebCodec and store them in memory
      await decodeVideo(
        this.src,
        (frame) => {
          this.frames.push(frame)
        },
        this.debug
      )
    } catch (error) {
      if (this.debug) messenger.error('Error encountered while decoding video', error)

      // Reset frames array and reload video element as fallback
      this.frames = []
      this.video.load()
    }

    // Exit if no frames were decoded successfully
    if (this.frames.length === 0) {
      if (this.debug) messenger.error('No frames were received from webCodecs')

      if (this.onReady) this.onReady()
      return
    }

    // Calculate frame rate based on video duration and number of frames
    this.frameRate = this.frames.length / this.video.duration
    if (this.debug) messenger.info('Received', this.frames.length, 'frames')
    if (this.debug) messenger.info('Frame rate:', this.frameRate, 'fps')

    // Create and configure canvas element for frame rendering
    this.canvas = document.createElement('canvas')
    this.canvas.classList.add('flooow-canvas')
    this.updateCanvasSize()
    this.context = this.canvas.getContext('2d')

    // Hide video element and append canvas to wrapper
    this.video.style.display = 'none'
    this.wrapper.appendChild(this.canvas)

    // Paint initial frame
    this.paintFrame(0)

    if (this.onReady) this.onReady()
  }

  /**
   * Paints a specific frame from the video onto the canvas, scaling to maintain aspect ratio
   * @param frameIndex The index of the frame to paint
   * @returns void
   * @private
   */
  private paintFrame(frameIndex: number) {
    const frame = this.frames[frameIndex]

    // Exit if frame or context is not available
    if (!frame || !this.context) return

    if (this.debug) messenger.info('Painting frame', frameIndex)

    // Get dimensions of both canvas and frame
    const { width: canvasWidth, height: canvasHeight } = this.canvas
    const { width: frameWidth, height: frameHeight } = frame

    const scaleX = canvasWidth / frameWidth
    const scaleY = canvasHeight / frameHeight

    // Calculate scale factor to maintain aspect ratio while filling canvas
    const scale = Math.max(scaleX, scaleY)

    // Clear previous frame from canvas
    this.context.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw frame centered on canvas with proper scaling
    this.context.drawImage(
      frame,
      (canvasWidth - frameWidth * scale) / 2,
      (canvasHeight - frameHeight * scale) / 2,
      frameWidth * scale,
      frameHeight * scale
    )
  }

  /**
   * Transitions video playback to a target timestamp using either canvas frame rendering
   * or video element playback. Handles both forward and backward transitions with
   * speed control and threshold detection.
   * @private
   */
  private playVideoTo() {
    if (this.debug) messenger.info('Transitioning targetTime:', this.targetTime, 'currentTime:', this.currentTime)

    // Calculate the difference between target and current time to determine transition direction
    const diff = this.targetTime - this.currentTime
    const isForwardTransition = diff > 0

    const tick = ({ startCurrentTime, startTimestamp }: TickOptions) => {
      // Check if we've reached or passed the target time based on transition direction
      const hasPassedThreshold = isForwardTransition
        ? this.currentTime >= this.targetTime
        : this.currentTime <= this.targetTime

      if (
        isNaN(this.targetTime) ||
        Math.abs(this.targetTime - this.currentTime) < this.frameThreshold ||
        hasPassedThreshold
      ) {
        // Stop video playback and animation if target is reached or invalid
        this.video.pause()
        if (this.transitioningRaf) {
          cancelAnimationFrame(this.transitioningRaf)
          this.transitioningRaf = null
        }
        return
      }

      // Clamp target time within valid video duration bounds
      if (this.targetTime > this.video.duration) this.targetTime = this.video.duration
      if (this.targetTime < 0) this.targetTime = 0

      const transitionForward = this.targetTime - this.currentTime

      if (this.canvas) {
        // Use canvas rendering for frame-perfect transitions
        this.currentTime = this.targetTime
        this.paintFrame(Math.floor(this.currentTime * this.frameRate))
      } else if (this.isSafari || !isForwardTransition) {
        // Use direct time setting for Safari or backward transitions
        this.video.pause()
        this.currentTime = this.targetTime
        this.video.currentTime = this.currentTime
      } else {
        // Adjust playback speed for smooth forward transitions
        const playbackRate = Math.max(Math.min(transitionForward * 4, this.transitionSpeed, 16), 1)

        if (this.debug) messenger.info('ScrollyVideo playbackRate:', playbackRate)
        // Apply playback rate if valid
        if (!isNaN(playbackRate)) {
          this.video.playbackRate = playbackRate
          this.video.play()
        }

        this.currentTime = this.video.currentTime
      }

      // Schedule next animation frame for continuous transition
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

    // Start the animation loop with initial timestamp
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

  /**
   * Updates the video playback progress and triggers a transition to the corresponding timestamp
   * @param progress Number between 0 and 1 representing video progress
   * @returns void
   */
  setVideoProgress(progress: number) {
    // Skip if progress hasn't changed to avoid unnecessary updates
    if (this.videoProgress === progress) return

    // Update video progress and calculate new target time
    this.videoProgress = progress
    this.currentTime = this.video.currentTime
    this.targetTime = this.videoProgress * this.video.duration
    this.playVideoTo()
  }

  /**
   * Updates canvas dimensions to match wrapper element size
   * @returns void
   * @private
   */
  private updateCanvasSize() {
    if (!this.canvas || !this.wrapper) return

    const wrapperRect = this.wrapper.getBoundingClientRect()

    this.canvas.width = wrapperRect.width
    this.canvas.height = wrapperRect.height
  }

  /**
   * Cleans up event listeners and removes video/canvas elements from the DOM.
   * Should be called when the Flooow instance is no longer needed.
   */
  destroy() {
    if (this.debug) messenger.info('Destroying ScrollyVideo')

    if (this.resize) window.removeEventListener('resize', this.resize)

    if (this.wrapper) this.wrapper.innerHTML = ''
  }
}

export default Flooow
