function displayTweet() {
    var tweet = document.getElementById("tweeet");
    var id = "1222478745514184705";
  
    twttr.widgets.createTweet(
    id, tweet,
    {
        conversation : 'all',    // or all
        cards        : 'hidden',  // or visible
        linkColor    : '#cc0000', // default is blue
        theme        : 'light'    // or dark
    })

    console.log('TWEEEEEEEEET RENDERED')
    // .then (function (el) {
    // el.contentDocument.querySelector(".footer").style.display = "none";
    // });
}