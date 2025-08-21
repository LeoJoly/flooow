import Flooow from '@/index'

const $wrapper = document.querySelector('#video-wrapper')

if ($wrapper) {
  const flooow = new Flooow({
    debug: true,
    src: 'https://pp-animation-mockup.vercel.app/videos/OK_scroll-test.mp4',
    useWebCodec: true,
    wrapper: $wrapper,
    onReady: () => {
      console.log('ready')
    }
  })

  $wrapper.addEventListener('mousemove', (event) => {
    const mouseX = (event as MouseEvent).clientX
    const width = $wrapper.clientWidth

    flooow.setVideoProgress(mouseX / width)
  })
}
