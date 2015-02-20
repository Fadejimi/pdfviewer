/* Copyright 2014 Reitbauer Rainer
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var SCALE_DEFAULT = 1;
var MIN_SCALE = 0.2;
var MAX_SCALE = 3;
var MIN_RESOLUTION = 600;

var screenWidth = window.innerWidth;
var scaleToWindow = true;
var timeout = false;
var scaleSteps = [];
var url;

var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = SCALE_DEFAULT,
    canvas,
    pageLayer,
    context;
		
		
var documentproperty = {
    pagecount : 0
};

        
var main = function() {
    
    url = getPathToFile();

    if(url === undefined) {
        console.log("no file specified.. not rendering any pdf"); // TODO not load pdf or show default pdf
        document.getElementById("indicator").className = "error";
    }
    else {
    /** Asynchronously downloads PDF.	*/
    PDFJS.getDocument(url).then(function (pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById("page_count").innerHTML = pdfDoc.numPages;
        documentproperty.pagecount = pdfDoc.numPages;
        console.log("finished loading pdf..");

        initUI();
        
        setUpEventListeners();

        // Initial/first page rendering
        renderPage(pageNum);

        }, function () { 
            document.getElementById("indicator").className = "error";
        });
    }
	
	console.log("entering main function...");
        
    // doesn't work on Android 4.4 browser
    if(!isFullscreenAvailable()) { 
        document.getElementById("fullscreen").style.display="none";
    }
	 	
    pageLayer = document.getElementById("page-layer");
    canvas = document.getElementById("the-canvas");
	context = canvas.getContext("2d");
        
    document.getElementById("input-embed").value = getEmbedText();
         
	console.log("exiting main function...");
};

function setUpEventListeners() {
    console.log("setting event listeners...");
    document.getElementById("btn-prev").addEventListener("click",onPrevPage,false);
    document.getElementById("btn-next").addEventListener("click",onNextPage,false);
    document.getElementById("scale").addEventListener("change",onScaleChange,false);
    document.getElementById("page_num").addEventListener("change",onPageChange,false);
    document.getElementById("embed").addEventListener("click",onEmbed,false);
    document.getElementById("btn-fullscreen").addEventListener("click",onFullscreen,false);
    document.getElementById("btn-zoom").addEventListener("click",onZoom,false);
    document.getElementById("page_num").addEventListener("click", function() { document.getElementById("page_num").select(); });
    //window.addEventListener("resize", toggleZoomButton, false);
    //window.addEventListener("resize", rescalePDF, false);
    window.addEventListener("resize", onResize, false);
}

function renderPage(num) {
    pageRendering = true;
    document.getElementById("indicator").style.display="block";
        
    // Using promise to fetch the page
    pageNum = num;
    pdfDoc.getPage(num).then(displayPage, function() {
        console.log("failed to load page: " + num);
	});

    // Update page counters
    document.getElementById("page_num").value = num;
    document.getElementById("content").scrollTop = 0;
}

function getBrowserDimensions() {
    var dimension = {
        x : document.getElementById("content").clientWidth,
        y : document.getElementById("content").clientHeight
    }
    return dimension;
}

function calcScaleToWindow(page) {
    scale = SCALE_DEFAULT;
        
    var viewport = page.getViewport(scale);
    var dimensions = getBrowserDimensions();
        
    if(viewport.width  < dimensions.x/2) { // or 1.5
        console.log("we need a new scale...");
        scale = (dimensions.x - 30) / viewport.width
        scale *= 0.7;
        viewport = page.getViewport(scale);
    }
    else {
        scale = (dimensions.x - 30) / viewport.width
        viewport = page.getViewport(scale);
    }
    console.log("and now scale is: " + scale);
                    
    scaleSteps["_50"] = scale * 0.5;
    scaleSteps["_75"] = scale * 0.75;
    scaleSteps["_100"] = scale;
    scaleSteps["_125"] = scale * 1.25;
    scaleSteps["_150"] = scale * 1.5;
    scaleSteps["_175"] = scale * 1.75;
    scaleSteps["_200"] = scale * 2;
            
    var scaleElement = document.getElementById("scale");
            
    scaleElement.value = 100;
    scaleToWindow = false;            
    pageNumPending = null;
        
    return viewport;
}

function checkForHiDPI(viewport) {     
    console.log("\n");
    var outputScale = getOutputScale(context);
    if (outputScale.scaled) {
        console.log("we are on a hidpi display.");
        console.log("device pixel ratio is: " + outputScale.sx + " " + outputScale.sy);
        console.log("viewport width: " + viewport.width);
        
        canvas.width = (Math.floor(viewport.width) * outputScale.sx) | 0;
        canvas.height = (Math.floor(viewport.height) * outputScale.sy) | 0;
        console.log("canvas width: " + canvas.width);
        context._scaleX = outputScale.sx;
        context._scaleY = outputScale.sy;
        
        context.scale(outputScale.sx, outputScale.sy);
    }
    else {
        console.log("no hidpi display");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
    }
        
}
    
function displayPage(page) {
    console.log("at this moment, scale is : " + scale);
    var viewport = null;
        
    if(scaleToWindow) {
        viewport = calcScaleToWindow(page);
    }
    else {
        viewport = page.getViewport(scale);
    }
        
    //checkForHiDPI(viewport);

    canvas.height = viewport.height;
    canvas.width = viewport.width;
       
    pageLayer.style.height = canvas.height+"px";
    pageLayer.style.width = canvas.width+"px";
       
    // render PDF page into canvas context
    var renderContext = {
        canvasContext: context,
        viewport: viewport
    };
        
    var textLayerDiv = document.getElementById("text-layer");
    textLayerDiv.innerHTML = "";
    
    textLayerDiv.style.height = canvas.height + "px";
    textLayerDiv.style.width = canvas.width + "px";
        
    var renderTask = page.render(renderContext);
        
    // create the text layer
    var textLayerPromise = page.getTextContent().then(function (textContent) {
        var textLayerBuilder = new TextLayerBuilder({
            textLayerDiv: textLayerDiv,
            viewport: viewport,
            pageIndex: (pageNum-1)
        });
        textLayerBuilder.setTextContent(textContent);
    });
        
    renderTask.promise.then(function () {
        pageRendering = false;
        pageLayer.style.display = "block";
        document.getElementById("indicator").style.display="none";

          
        if (pageNumPending !== null) {
            // new page rendering is pending
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    });
        
    return Promise.all([renderTask.promise, textLayerPromise]);
}
		
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } 
    else {
        renderPage(num);
    }
}
	
function onNextPage() {
    if(pageNum >= documentproperty.pagecount) {
	   return;
    }
    pageNum++;
	queueRenderPage(pageNum);
}
	
function onPrevPage() {
    if (pageNum <= 1) {
	   return;
    }
	pageNum--;
	queueRenderPage(pageNum);
}
        
function onEmbed() {
    if(screenWidth <= MIN_RESOLUTION) {
        closeIfOpen(document.getElementById("scaling"));
    }
    
    document.getElementById("input-embed").value = getEmbedText();
    var embedMenu = document.getElementById("embed-menu");
    if(embedMenu.style.display == "none") {
        embedMenu.style.display = "block";
        document.getElementById("input-embed").focus();
        document.getElementById("input-embed").select();
    }
    else {
        embedMenu.style.display = "none"; 
    }
            
}

function onScaleChange() {
    var value = parseFloat(document.getElementById("scale").value);
	if(!isNaN(value)) {
		console.log("new scale is: " + value);
        scale = scaleSteps["_" + value.toString()];
        queueRenderPage(pageNum);
        document.getElementById("scaling").title = "Zoom: " + value + "%";
	}
	else {
		return;
	}
	
}

function onZoom() {
    closeIfOpen(document.getElementById("embed-menu"));
        
    var scaleingElement = document.getElementById("scaling");
    if(scaleingElement.style.display == "inline") {
        scaleingElement.style.display = "none";
    }
    else {
        scaleingElement.style.display = "inline"; 
    }
}

function closeIfOpen(elem) {
    if(elem.style.display != "none") {
        elem.style.display = "none";   
    }
}

function onPageChange() {        
    var pageNumInput = document.getElementById("page_num");
    var value = parseInt(pageNumInput.value);
        
    if(!isNaN(value)) {
        if(value >=1 && value <= pdfDoc.numPages) {
            console.log("going to page: " + value);
            pageNum = value;
            queueRenderPage(pageNum);
        }
        else {
            pageNumInput.value = pageNum;
            return;
        }
    }
    else {
        pageNumInput.value = pageNum;
        return;
    }
}	
	
	
function getUrl() {
    return window.location.href;
}
	
function getPathToFile() {
	var url = getUrl();
		
	var filePath = url.split("?file=");
	if(filePath.length !== 2) {
        console.log("error parsing filename!");
		return;
	}
	else {
        return filePath[1];
    }
		
    return;		
}
        
function getEmbedText() {
    return '<iframe src=\"'+getUrl()+'\" width="100%" height="600" frameborder="0" allowfullscreen webkitallowfullscreen></iframe>';
}
	
function isFullscreenAvailable() {
    if  (document.fullscreenEnabled || document.mozFullScreenEnabled || 
        document.webkitFullscreenEnabled || document.msFullscreenEnabled) {
        return true;
    }
    else {
        return false;
    }
            
}

function isFullscreen() {
    if ( document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement ) {
        return true;   
    }
    else {
        return false;
    }
}

function goFullscreen(id) {
    console.log("going fullscreeen");
    var element = document.getElementById(id);
 
    // go full-screen
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    console.log("leaving fullscreen");
}

function onFullscreen() {
    if(isFullscreen() == false) {
        goFullscreen("viewer");
    }
    else {
        exitFullscreen();
    }
}

function initUI() {
    document.getElementById("page_count").innerHTML = documentproperty.pagecount;
    document.getElementById("page_num").min = "1";
    document.getElementById("page_num").max = documentproperty.pagecount;
		
}

function toggleZoomButton() {
    var scaleingElement = document.getElementById("scaling");
    if(window.innerWidth > MIN_RESOLUTION) {
        scaleingElement.style.display = "inline";
    }
    else if(screenWidth > MIN_RESOLUTION) {
        scaleingElement.style.display = "none";
    }
};

    
function rescalePDF() {
    console.log("going to resize the pdf..:");
    scaleToWindow = true;
    queueRenderPage(pageNum);
    timeout = false;
}

function onResize() {
    console.log("a window resize occured");
    toggleZoomButton();
    screenWidth = window.innerWidth;
    
    // workaround because chrome, ff etc fire multiple resize events
    if(timeout == false) {
        timeout = true;
        window.setTimeout(rescalePDF, 200);
    } 
    else {
        return;
    }
}


document.addEventListener("DOMContentLoaded", main, false);
