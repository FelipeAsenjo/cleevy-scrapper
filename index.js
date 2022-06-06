const { Cluster } = require('puppeteer-cluster')
const puppeteer = require('puppeteer')
const fs = require('fs')
require('dotenv').config()

const { SUBDOMAIN, USER_NAME, PASSWORD } = process.env

const retrievedInfo = {}

const scrap = async () => {
  const data = await readDataFile()
  const urls = await data.map(x => `http://${x}${SUBDOMAIN}`)

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 1,
    timeout: 45000,
    monitor: true,
    puppeteerOptions: { // eliminar al finalizar
      headless: false,
      //slowMo: 250,
    }
  })

  cluster.on('taskerror', (err, info) => {
    console.log(`Error ${info}: ${err}`)
  })

  await cluster.task(async ({page, data}) => {

    await page.goto(data.url)
    const client = page.url().split(/\W/gi)[3]

    // login
    if( page.url().includes('login') ) {
      await page.type('#user_email', USER_NAME)
      await page.type('#user_password', PASSWORD)
      await page.click('.form-inputs .btn-primary')
    }
    await page.waitForSelector('.actions .dropdown-toggle')
    const btns = await page.$$('.actions li:last-child a') 

    // navigate & get data
    for(i = 0; i < btns.length; i++) {

      await page.evaluate(element => element.click(), btns[i])
      await page.waitForSelector('.modal [href="#year"]')
      const title = await page.evaluate(() => document.querySelector('.modal h2').innerText)
      await page.click('.modal [href="#year"]')
      const element = await page.evaluate(() => {
        const date = new Date()
        return document.querySelectorAll('#year td')[date.getMonth() - 1].innerText
      })
      
      if(element != 0) {
        pushData(page.url(), element, title)
      }
      
      // eliminar al finalizar
      await page.waitForTimeout(2000)
    }
  })

  //await cluster.queue({ url: urls[10] })
  await urls.forEach(url => cluster.queue({ url, USER_NAME, PASSWORD }))

  // enviar mail con los datos
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
  console.log(JSON.stringify(retrievedInfo))
}

scrap()
