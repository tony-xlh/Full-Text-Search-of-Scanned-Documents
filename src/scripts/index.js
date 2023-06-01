import localForage from "localforage";
import { Index } from "flexsearch";

let indexStore = localForage.createInstance({
  name: "index"
});

const documentIndex = new Index();
window.documentIndex = documentIndex;

document.getElementsByClassName("index-btn")[0].addEventListener("click",function(){
  IndexDocument();
  alert("Indexed");
});

document.getElementsByClassName("search-btn")[0].addEventListener("click",function(){
  search();
});

window.onload = function(){
  ListScannedDocuments();
  LoadIndexFromIndexedDB();
};

async function ListScannedDocuments(){
  let documents = document.getElementsByClassName("documents")[0];
  const keys = await localForage.keys();
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (key.endsWith("PDF")) {
      const timestamp = key.substring(0,13);
      AddOneDocumentItem(timestamp,documents);
    }
  }
}

function AddOneDocumentItem(timestamp,parent) {
  let listItem = document.createElement("li");
  let link = document.createElement("a");
  link.href = "document.html?timestamp="+timestamp;
  link.target = "_blank";
  link.innerText = getDocumentDate(timestamp);
  listItem.appendChild(link);
  parent.appendChild(listItem);
}

function getDocumentDate(timestamp){
  return new Date(parseInt(timestamp)).toLocaleString();
}

function SaveIndexToIndexedDB(){
  return new Promise(function(resolve){
    documentIndex.export(async function(key, data){ 
      // do the saving as async
      console.log(key);
      await indexStore.setItem(key, data);
      resolve();
    });
  });
}

async function LoadIndexFromIndexedDB(){
  console.log("load");
  const keys = await indexStore.keys();
  console.log(keys);
  for (const key of keys) {
    const content = await indexStore.getItem(key);
    documentIndex.import(key, content);
  }
}

function search(){
  document.getElementsByClassName("search-result-container")[0].style.display = "";
  const keywords = document.getElementById("keywords").value;
  const startTime = Date.now();
  const results = documentIndex.search(keywords);
  const endTime = Date.now();
  console.log(results);
  const info = document.getElementsByClassName("search-result-info")[0];
  info.innerText = "The keywords are found in the following documents in "+(endTime - startTime)+"ms";
  const ul = document.getElementsByClassName("search-result-list")[0];
  ul.innerHTML = "";
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const timestamp = parseInt(result.split("-")[0]);
    const pageIndex = parseInt(result.split("-")[1]);
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "javascript:void();";
    link.addEventListener("click",function(){
      //DWObject.CurrentImageIndexInBuffer = pageIndex;
      window.open("document.html?timestamp="+timestamp+"&page="+pageIndex,"_blank");
    });
    link.innerText = "Document: "+getDocumentDate(timestamp)+", Page "+(pageIndex+1);
    item.append(link);
    ul.append(item);
  }
}

async function IndexDocument(){
  const keys = await localForage.keys();
  //OCR results stored as timestamp+"-OCR-Data"
  const document = [];
  for (const key of keys) {
    if (key.indexOf("OCR-Data") != -1) {
      const resultsDict = await localForage.getItem(key);
      const timestamp = key.split("-")[0];
      const pageIndices = Object.keys(resultsDict);
      for (const i of pageIndices) {
        const result = resultsDict[i];
        if (result) {
          const id = timestamp+"-"+i;
          document.push({id:id,body:result.data.text});
        }
      }
    }
  }
  document.forEach(({ id, body }) => {
    if (id in Object.keys(documentIndex.register)) {
      documentIndex.remove(id);
    }
    documentIndex.add(id, body);
  });
  SaveIndexToIndexedDB();
}

