function displayTweet(elementID, tweetID) {  
    twttr.widgets.createTweet(
    tweetID, elementID,
    {
        conversation : 'all',    // or all
        cards        : 'hidden',  // or visible
        linkColor    : '#cc0000', // default is blue
        theme        : 'light'    // or light
    })
}