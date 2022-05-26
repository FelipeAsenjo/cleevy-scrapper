const { Cluster } = require('puppeteer-cluster')
const puppeteer = require('puppeteer')
const fs = require('fs')
require('dotenv').config()

const { SUBDOMAIN, USER_NAME, PASSWORD } = process.env

const scrap = async () => {
  const data = await readDataFile()
  const urls = await data.map(x => `http://${x}${SUBDOMAIN}`)
  
  console.log(urls)

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 1,
    timeout: 45000,
    monitor: true,
    puppeteerOptions: {
      headless: false,
      //slowMo: 500, 
    }
  })

  cluster.on('taskerror', (err, data) => {
    console.log(`Error ${data}: ${err.message}`)
  })


  await cluster.task(async ({page, data}) => {

    await page.goto(data.url)
    if( page.url().includes('login') ) {
      await page.type('#user_email', USER_NAME)
      await page.type('#user_password', PASSWORD)
      await page.click('.form-inputs .btn-primary')
    }
    await page.waitForSelector('.thumbnails li')
    const listElements = await page.$('.thumbnails > li')
    const titles = await page.evaluate(() => {
      const elements = document.querySelectorAll('.thumbnails > li') 

      const arrTitles = []
      for( let element of elements) {
        arrTitles.push(element.innerText) 
      }
      
      return elements
    })
    console.log(titles)
  })


  await cluster.queue({ url: urls[0] })
  //await urls.forEach(url => cluster.queue({ url, USER_NAME, PASSWORD }))

  await cluster.idle()
  await cluster.close()
}

const readDataFile = async () => {
  return new Promise((resolve, reject) => {
    fs.readFile('clients.json', 'utf8', (err, data) => {
      resolve(JSON.parse(data))
    })
  })
}

scrap()
