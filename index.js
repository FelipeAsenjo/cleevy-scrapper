const { Cluster } = require('puppeteer-cluster')
const puppeteer = require('puppeteer')
const fs = require('fs')
require('dotenv').config()
const { SUBDOMAIN, USER_NAME, PASSWORD } = process.env

/* SCRIPT STATE */
const retrievedInfo = {}
const failedUrls = []
const date = new Date()
const month = Number(process.env.MONTH) || date.getMonth() - 1


/* INIT SCRAPING */
const scrap = async () => {
  let clients = process.env.CLIENTS || await readDataFile()
  if(typeof clients === 'string') clients = clients.split(' ') 
  const urls = await clients.map(x => `http://${x}${SUBDOMAIN}`)

  /* DEFINE CLUSTER */
  const cluster = await Cluster.launch({ 
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 1,
    timeout: 65000,
    monitor: true,
    /*puppeteerOptions: { // DEBUGGING PURPOSES
      headless: false,
    } */
  })

  /* ERROR HANDLER */
  cluster.on('taskerror', (err, info) => {
    const clientDomain = subStringUrl(info.url)

    console.log('\x1b[41m%s\x1b[0m', `${clientDomain}`.toUpperCase())
    failedUrls.push(clientDomain)
  })

  /* INIT SCRAPING */
  await cluster.task(async ({page, data}) => {

    await page.goto(data.url)
    const clientDomain = subStringUrl(page.url())

    /* LOGIN */
    if( page.url().includes('login') ) {
      await page.type('#user_email', USER_NAME)
      await page.type('#user_password', PASSWORD)
      await page.click('.form-inputs .btn-primary')
    }
    await page.waitForSelector('.actions .dropdown-toggle')
    await page.waitForTimeout(500)
    const btns = await page.$$('.actions li:last-child a') 

    /* NAVIGATE & GET DATA */
    for(i = 0; i < btns.length; i++) {

      await page.evaluate(element => element.click(), btns[i])
      await page.waitForSelector('.modal [href="#year"]')
      await page.waitForTimeout(500)
      const surveyTitle = await page.evaluate(() => document.querySelector('.modal h2').innerText)
      await page.click('.modal [href="#year"]')
      await page.waitForSelector('#year td')
      await page.waitForTimeout(500)
      const nOfSurveys = await page.evaluate(month => {
        return document.querySelectorAll('#year td')[month].innerText
      }, month)

      if(nOfSurveys != 0) {
        await pushData(clientDomain, nOfSurveys, surveyTitle)
      }

      // DEBUGGING PURPOSES
      //await page.waitForTimeout(1500) 
    }
    
    /* SHOW WEBSITE RESULTS IN A TABLE */
    console.log('\x1b[42m%s\x1b[0m', `${clientDomain}:`.toUpperCase())
    console.table(retrievedInfo[clientDomain])
  })

  await urls.forEach(url => cluster.queue({ url }))

  await cluster.idle()
  await cluster.close()

  /* GET FAILED CLIENT DOMAINS */
  const failedClients = failedUrls.map(url => subStringUrl(url))
  console.log(failedClients.join(' '))

  /* SAVE DATA IN FILE */
  saveResultsInFile(JSON.stringify(retrievedInfo, null, 4))
}

/* ---------- UTILITIES ---------- */

const subStringUrl = url => /[^.]+/.exec(url)[0].substr(8)

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
}

const saveResultsInFile = data => {
  fs.writeFile(`surveys_${month + 1}-${date.getFullYear()}_${Date.now()}.json`, data, (err) =>{
    if(err) {
      console.log(err)
      return
    }
    console.log('Data saved succesfully')
  })
}

scrap()
