import Dynamsoft from "dwt";
import { createWorker } from 'tesseract.js';
import { getUrlParam } from './utils';
import localForage from "localforage";
import '../styles/document.scss';

let DWObject;
let worker;
let resultsDict = {};
let timestamp = undefined;

window.onload = function(){
  initDWT();
  initTesseract();
};

function registerEvents() {
  DWObject.RegisterEvent('OnBufferChanged',function (bufferChangeInfo) {
    const selectedIds = bufferChangeInfo["selectedIds"];
    console.log(bufferChangeInfo);
    if (selectedIds.length === 1) {
      showTextOfPage(DWObject.ImageIDToIndex(selectedIds[0]));
    }
  });

  document.getElementsByClassName("scan-btn")[0].addEventListener("click",async function(){
    if (DWObject) {
      await DWObject.SelectSourceAsync();
      DWObject.AcquireImageAsync();
    }
  });
  document.getElementsByClassName("load-btn")[0].addEventListener("click",function(){
    if (DWObject) {
      DWObject.IfShowFileDialog = true;
      // PDF Rasterizer Addon is used here to ensure PDF support
      DWObject.Addon.PDF.SetResolution(200);
      DWObject.Addon.PDF.SetConvertMode(Dynamsoft.DWT.EnumDWT_ConvertMode.CM_RENDERALL);
      DWObject.LoadImageEx("", Dynamsoft.DWT.EnumDWT_ImageType.IT_ALL);
    }
  });

  document.getElementsByClassName("edit-btn")[0].addEventListener("click",function(){
    if (DWObject) {
      let imageEditor = DWObject.Viewer.createImageEditor();
      imageEditor.show();
    }
  });

  document.getElementsByClassName("ocr-btn")[0].addEventListener("click",function(){
    OCRSelected();
  });

  document.getElementsByClassName("batch-ocr-btn")[0].addEventListener("click",function(){
    BatchOCR();
  });

  document.getElementsByClassName("download-text-btn")[0].addEventListener("click",function(){
    DownloadText();
  });

  document.getElementsByClassName("save-btn")[0].addEventListener("click",function(){
    SaveDocument();
  });

  document.getElementsByClassName("save-pdf-btn")[0].addEventListener("click",function(){
    SaveAsPDF();
  });
}

function showTextOfPage(index){
  if (resultsDict[index]) {
    console.log(resultsDict);
    const text = resultsDict[index].data.text;
    document.getElementsByClassName("text")[0].innerText = text;
  }else{
    document.getElementsByClassName("text")[0].innerText = "";
  }
}

function initDWT(){
  const containerID = "dwtcontrolcontainer";
  Dynamsoft.DWT.RegisterEvent('OnWebTwainReady', () => {
    DWObject = Dynamsoft.DWT.GetWebTwain(containerID);
    DWObject.Viewer.width = "100%";
    DWObject.Viewer.height = "100%";
    registerEvents();
    LoadProject();
  });
  
  Dynamsoft.DWT.ResourcesPath = "/dwt-resources";
  Dynamsoft.DWT.Containers = [{
      WebTwainId: 'dwtObject',
      ContainerId: containerID
  }];
  Dynamsoft.DWT.Load();
}

async function initTesseract(){
  const status = document.getElementById("status");
  status.innerText = "Loading tesseract core...";
  worker = await createWorker({
    logger: m => console.log(m)
  });
  status.innerText = "Loading lanuage model...";
  await worker.loadLanguage('eng');
  status.innerText = "Initializing...";
  await worker.initialize('eng');
  status.innerText = "Ready";
}

async function OCRSelected(){
  if (DWObject && worker) {
    const index = DWObject.CurrentImageIndexInBuffer;
    const skipProcessed = document.getElementById("skip-processed-chk").checked;
    if (skipProcessed) {
      if (resultsDict[index]) {
        console.log("Processed");
        return;
      }
    }
    const status = document.getElementById("status");
    status.innerText = "Recognizing...";
    const data = await OCROneImage(index);
    resultsDict[index] = data;
    status.innerText = "Done";
    showTextOfPage(index);
  }
}

async function BatchOCR(){
  if (DWObject && worker) {
    const skipProcessed = document.getElementById("skip-processed-chk").checked;
    const status = document.getElementById("status");
    for (let index = 0; index < DWObject.HowManyImagesInBuffer; index++) {
      if (skipProcessed) {
        if (resultsDict[index]) {
          console.log("Processed");
          continue;
        }
      }
      status.innerText = "Recognizing page "+(index+1)+"...";
      const data = await OCROneImage(index);
      resultsDict[index] = data;
    }
    status.innerText = "Done";
  }
}

async function OCROneImage(index){
  return new Promise(function (resolve, reject) {
    if (DWObject) {
      const success = async (result) => {
        const data = await worker.recognize(result);
        resolve(data);
      };
      const failure = (errorCode, errorString) => {
        reject(errorString);
      };
      DWObject.ConvertToBlob([index],Dynamsoft.DWT.EnumDWT_ImageType.IT_JPG, success, failure);
    }else{
      reject("Not initialized");
    }
  });
}

function DownloadText(){
  let text = getJoinedText();
  let filename = 'text.txt';
  let link = document.createElement('a');
  link.style.display = 'none';
  link.setAttribute('target', '_blank');
  link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getJoinedText(){
  let text = "";
  if (DWObject) {
    for (let index = 0; index < DWObject.HowManyImagesInBuffer; index++) {
      if (resultsDict[index]) {
        text = text + resultsDict[index].data.text;
      }
      text = text + "\n\n=== "+ "Page "+ (index+1) +" ===\n\n";
    }
  }
  return text;
}

async function SaveDocument() {
  document.getElementsByClassName("save-btn")[0].innerText = "Saving...";
  await SaveOCRResults(timestamp);
  await SavePages(timestamp);
  document.getElementsByClassName("save-btn")[0].innerText = "Save to IndexedDB";
  alert("Saved");
}

async function SaveOCRResults(timestamp){
  await localForage.setItem(timestamp+"-OCR-Data",resultsDict);
}

function SavePages(timestamp){
  return new Promise(function (resolve, reject) {
    if (DWObject) {
      const success = async (result) => {
        await localForage.setItem(timestamp+"-PDF",result);
        resolve();
      };
      const failure = (errorCode, errorString) => {
        reject(errorString);
      };
      DWObject.ConvertToBlob(getAllImageIndex(),Dynamsoft.DWT.EnumDWT_ImageType.IT_PDF, success, failure);
    }else{
      reject();
    }
  });
}

function SaveAsPDF(){
  if (DWObject) {
    DWObject.SaveAllAsPDF(
      "Scanned",
      function() {
        console.log("saved");
      },
      function() {
        console.log("failed");
      }
    );
  }
  
}

function getAllImageIndex(){
  let indices = [];
  if (DWObject) {
    for (let index = 0; index < DWObject.HowManyImagesInBuffer; index++) {
      indices.push(index);
    }
  }
  return indices;
}

async function LoadProject(){
  timestamp = getUrlParam("timestamp");
  let query = getUrlParam("query");
  let pageIndex = getUrlParam("page");
  if (timestamp) {
    const OCRData = await localForage.getItem(timestamp+"-OCR-Data");
    if (OCRData) {
      resultsDict = OCRData;
    }
    const PDF = await localForage.getItem(timestamp+"-PDF");
    if (PDF) {
      if (DWObject) {
        DWObject.LoadImageFromBinary(
          PDF,
          function () {
            console.log("success");
            if (pageIndex) {
              DWObject.CurrentImageIndexInBuffer = pageIndex;
              showTextOfPage(pageIndex);
              if (query) {
                highlightQuery(query);
              }
            }else{
              DWObject.CurrentImageIndexInBuffer = 0;
              showTextOfPage(0);
            }
          },
          function (errorCode, errorString) {
            console.log(errorString);
          }
        );
      }
    }
  }else{
    timestamp = Date.now();
  }
}

function highlightQuery(query){
  let content = document.getElementsByClassName("text")[0].innerHTML;

  // Build regex
  const regexForContent = new RegExp(query, 'gi');
  console.log(regexForContent);
  // Replace content where regex matches
  content = content.replace(regexForContent, "<span class='hightlighted'>$&</span>");

  document.getElementsByClassName("text")[0].innerHTML = content;
}

