console.log("start");
var sheets = document.styleSheets;
var aSheet = sheets[0];
aSheet.insertRule("ytd-browse.style-scope.ytd-page-manager { display: none !important; }");
aSheet.insertRule(".ytd-watch-next-secondary-results-renderer { display: none !important; }");

// var main = document.querySelector("ytd-browse");
// console.log('main', main);
// if (main) main.style.display = "none";

// var secondary = document.querySelector(".ytd-watch-next-secondary-results-renderer");
// console.log('secondary', secondary);
// if (secondary) secondary.style.display = "none";


// var observer = new MutationObserver(function(mutations, thisObserver) {
//   mutations.forEach(function(mutation) {
//     if (!mutation.addedNodes) return

//     for (var i = 0; i < mutation.addedNodes.length; i++) {
//       // do things to your newly added nodes here
//       var node = mutation.addedNodes[i]
//       // console.log(node);
//       if (node.nodeName && node.nodeName.includes("ytd-browse")) {
//         node.style.display = "none";
//           // console.log(node.nodeName);
//       }

//       if (node.className && node.className.includes) {
//         if (node.className.includes("ytd-watch-next-secondary-results-renderer")) {
//           node.style.display = "none";
//           // console.log(node.className);
//         }

//         if (node.className.includes("videoAdUiAttribution")) {
//           console.log(node.className);
//           alert("1");
//         }
//       }
//     }
//   })
// })

// observer.observe(document.body, {
//     childList: true
//   , subtree: true
//   , attributes: false
//   , characterData: false
// })
