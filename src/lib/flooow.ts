import { logStuff } from '@/utils/log-stuff'
import { UAParser } from 'ua-parser-js'

type FlooowOptions = {
  src: string
  wrapper: Element | string
  debug?: boolean
}

class Flooow {
  debug = false
  isSafari = false
  src!: string

  videoProgress = 0

  canvas!: HTMLCanvasElement
  context!: CanvasRenderingContext2D

  frames: Array<HTMLImageElement> = []
  frameRate = 0

  video!: HTMLVideoElement
  wrapper!: Element

  constructor({ debug = false, src, wrapper }: FlooowOptions) {
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
    this.src = src

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
  }

  setVideoProgress(progress: number) {
    if (this.videoProgress === progress) return

    this.videoProgress = progress
    this.playVideoTo()
  }

  playVideoTo() {
    this.video.currentTime = this.videoProgress * this.video.duration
  }
}

export default Flooow
