/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

class Messenger {
  private title = '%cFlooow:'
  private style = 'background-color: #e6693c; padding: 2px 4px; border-radius: 3px'

  info(...arg: any[]) {
    console.info(this.title, this.style, ...arg)
  }

  error(...arg: any[]) {
    console.error(this.title, this.style, ...arg)
  }

  warn(...arg: any[]) {
    console.warn(this.title, this.style, ...arg)
  }
}

const messenger = new Messenger()

export default messenger
