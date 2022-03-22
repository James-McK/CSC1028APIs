# APIs for CSC1028 Project

See <https://mck.is/CSC1028> for further details.

## HTTP APIs

[GitHub](https://github.com/James-McK/CSC1028APIs)  
The main component of this project is a set of HTTP APIs that can be queried for information on a URL/IP address to provide information from various sources, from local databases to external APIs.
The current data sources are:

- A local MongoDB database containing data from Project Sonar
- A local MongoDB database containing data on phishing/malware URLs from [Phishtank](https://phishtank.org/), [OpenPhish](https://openphish.com/), [URLHaus](https://urlhaus.abuse.ch/) and [MalwareDiscoverer](https://malwarediscoverer.com/).
- Earliest page/hostname archive date, from <https://archive.org>.
- [Similarweb](https://www.similarweb.com/) global website rank
- IP Geolocation data (Currently from <https://ip-api.com/>, could probably be improved - this section did not have much thought put into it, and was mostly done as a proof of concept)

Several of these can also be queried via the command line, i.e. `node queryArchiveDate.js example.com`

For more information on dealing with Project Sonar's data, see [my how-to guide](https://mck.is/project-sonar/), but in summary, the data is stored in a local MongoDB database which, when full, can fill up to 60gb. We then use [text indexes](https://docs.mongodb.com/manual/core/index-text/) to allow _extremely_ performant queries to be made.

Note on Project Sonar's data:
6 days after I wrote my how-to guide, [Rapid7 switched to requiring you to apply](https://www.rapid7.com/blog/post/2022/02/10/evolving-how-we-share-rapid7-research-data-2/) to access Project Sonar's data. Except now, a few weeks later, it no longer requires an account again, and this time I cannot find any blog post etc. mentioning this change back, so I do not know if this is a permanent or temporary change.

### Retrieving data

To retrieve the data used for the above HTTP APIs, some of the modules send a request to an external API, while some query a local MongoDB database. To fetch the data used to fill up the MongoDB database, there exists two programs: One for parsing and inserting Project Sonar's data, and one for fetching, parsing and inserting malware/phishing data.

### Creating the HTTP APIs

To create and manage the HTTP APIs, there is a single program (`createAllAPI.js`) that opens up all the APIs when run (Ports 10130 to 10135 by default). This program does almost nothing itself, and imports functionality from other modules to create the APIs (Notably `createHTTPServer.js`, which will take any function and open up an API for it on the given port.). This approach allows new APIs to be added with ease, and allows you to manage which modules are started.

### Running/developing the application

For developing any of this project, you'll need a few things set up and installed. I'd recommend following the setup process I used in [my how-to guide](https://mck.is/project-sonar/#setup). You'll also want to install the dependancies listed in `package.json` with `npm install <package_name>`.
To actually get the data, you'll first want to run `./fetch/fetchMalwarePhishingData.js` and `./fetch/fetchMalwarePhishingData.js` (Assuming you've downloaded Project Sonar's data in a similar way as I did in my [how-to guide](https://mck.is/project-sonar/#parsing-a-local-copy-of-project-sonar)).  
You can then run `node ./create/createAllAPI.js` to start the APIs.

### Testing plan

The easiest way to ensure the node.js APIs are working is to start the application by running `npm start` and querying them in your browser. For example, to query the archive date API, which is hosted on port 10133, you'd visit `http://localhost:10133/example.com` .  
![Example output from the API](DebuggingAPI.png)

I've found that the best way to debug it is to make thorough use of `console.log(...);` to make sure I know the state of variables over time, which is extremely useful in helping to detect any issues.

### Further development

I've tried to make adding additional functionality to the API as easy as possible. All APIs are set up in the `createAllAPI.js` file, which itself contains very little code, and as a whole, the application is developed very modularly. As an example, we'll cover how querying similarweb works, as it has more requirements to get working than other functions. (You can view all the code for this [here](https://github.com/James-McK/CSC1028APIs/blob/master/query/querySimilarweb.js))

All query functions are stored in the `create` folder, and our function for querying similarweb is stored in `querySimilarweb.js`. At the top of the file, we begin by importing any other modules or functions we'll need.

```
import "dotenv/config";
import getRemoteJSON from "./queryRemoteJSON.js";
import parseHostname from "../parse/parseHostname.js";
import createCli from "../create/createCli.js";
```

First of all, we're importing the `dotenv` module, as querying similarweb requires an API key, which we'll store in a `.env` file (More on that later). We're also using a couple of other functions that are defined in other files - `queryRemoteJSON.js` fetches JSON from a URL and `parseHostname.js` parses the string containing the URL into a URL object. `createCli.js` is used for allowing the function to be used via the command line (i.e. `node ./query/querySimilarweb.js example.com`), but this part of the application is just an optional extra that some of the functions provide, and isn't worth worrying much about.

Next up, we want to create the function that will actually be used to make the query. Since we're planning to use this function later on in a different file, we'll also need to export the function using `export default`. The function will also need to take in the URL that is being queried. We can then parse this into a URL object, which will allow us to select just the hostname, by using the `parseHostname` function we imported earlier. Then we build the string for the API that we're querying, and we can use the `getRemoteJSON` function we imported earlier to query the API, and we can return the result.

```
let parsed = parseHostname(url);
// Construct the URL to query
const fetchUrl = `https://api.similarweb.com/v1/similar-rank/${parsed.hostname}/rank?api_key=${process.env.SIMILARWEB_KEY}`;

// Get the result of the query
let res = await Promise.resolve(getRemoteJSON(fetchUrl));

// If an error occurred, return -1, otherwise return the rank
if (res.meta.status === "Error") return -1;
else return res.similar_rank.rank;
```

Now, you might have noticed that nowhere in there are we creating our own queryable HTTP API or anything. So how does that happen?  
This is where the advantage of the application's modularity comes in. To see this in action, we can go back to the `createAllAPI.js` file.

Again, at the top of the file, we're importing all the functions we need from other files (notably `import createHttpServer from "./createHttpServer.js";` and `import fetchSimilarwebRank from "../query/querySimilarweb.js";`). Then, in our main function, we can call the `createHttpServer` function we've just imported, and we pass it the port we want it to use, and the function we want to use. In this case we're using port 10131 (Picked because it is not used by any major applications, see <https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers>) and the `fetchSimilarwebRank` function. This `createHttpServer.js` allows us to add additional functionality on different ports with minimal effort, as it handles all of the networking side of the API, without this having to be re-architected for each additional function provided. You shouldn't even need to understand exactly what the `createHttpServer` function does to be able to use it, but if you do, the code is well commented.

#### .env Files and API keys

Since I can't just share my API keys for anybody to use, the application makes use of a `.env` file to store these. This allows these secret values to be stored in a file that is not publicly exposed.

However, this means you will have to get your own API keys for the services that require them. Currently this is just similarweb and stackshare.  
For getting a free similarweb API key (5000 requests per month), [see here](https://support.similarweb.com/hc/en-us/articles/4414317910929-Website-DigitalRank-API#UUID-b25b8106-20c9-2d5a-e7b2-cdee63a4eaa6_section-idm4621956633339232800133052352)  
For getting a free stackshare API key (100 requests per month), [see here](https://www.stackshare.io/api)

Once you've got the API keys you want, you can then create a `.env` file, using the provided `.env.template` file as a teplate. The result should look something like:

```
SIMILARWEB_KEY=abc1234
STACKSHARE_KEY=abcd
```
