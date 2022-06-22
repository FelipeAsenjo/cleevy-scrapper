const { Cluster } = require('puppeteer-cluster')
const puppeteer = require('puppeteer')
const fs = require('fs')
require('dotenv').config()

const { SUBDOMAIN, USER_NAME, PASSWORD } = process.env

const retrievedInfo = {}

const scrap = async () => {
  let clients = process.env.CLIENTS || await readDataFile()
  if(typeof clients === 'string') clients = clients.split(' ') 
  const urls = await clients.map(x => `http://${x}${SUBDOMAIN}`)

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 1,
    timeout: 65000,
    monitor: true,
    //puppeteerOptions: { // DEBUGGING PURPOSES
      //headless: false,
    //}
  })

  cluster.on('taskerror', (err, info) => {
    console.log('\x1b[41m%s\x1b[0m', `${info.url}`.split(/\W/gi)[3].toUpperCase())
  })

  await cluster.task(async ({page, data}) => {

    await page.goto(data.url)
    const client = page.url().split(/\W/gi)[3]
    const date = new Date()
    const month = Number(process.env.MONTH) || date.getMonth() - 1

    // LOGIN
    if( page.url().includes('login') ) {
      await page.type('#user_email', USER_NAME)
      await page.type('#user_password', PASSWORD)
      await page.click('.form-inputs .btn-primary')
    }
    await page.waitForSelector('.actions .dropdown-toggle')
    const btns = await page.$$('.actions li:last-child a') 

    // NAVIGATE & GET DATA
    for(i = 0; i < btns.length; i++) {

      await page.evaluate(element => element.click(), btns[i])
      await page.waitForSelector('.modal [href="#year"]')
      const title = await page.evaluate(() => document.querySelector('.modal h2').innerText)
      await page.click('.modal [href="#year"]')
      await page.waitForSelector('#year td')
      const element = await page.evaluate(month => {
        const date = new Date()
        return document.querySelectorAll('#year td')[month].innerText
      }, month)

      if(element != 0) {
        await pushData(page.url(), element, title)
      }

      // DEBUGGING PURPOSES
      await page.waitForTimeout(1500) 
    }
    
    console.log('\x1b[42m%s\x1b[0m', `${client}:`.toUpperCase())
    console.table(retrievedInfo[page.url()])
  })

  await urls.forEach(url => cluster.queue({ url }))

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

const pushData = (url, nOfSurveys, survey) => {
  if(!retrievedInfo[url]) {
    retrievedInfo[url] = {}
  }
  retrievedInfo[url][survey] = nOfSurveys
  //console.log(JSON.stringify(retrievedInfo))
}

scrap()
