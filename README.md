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
- IP Geolocation data (Currently from <https://ip-api.com/>, could probably be improved - this section did not have much thought put into it.)

For more information on dealing with Project Sonar's data, see [my how-to guide](https://mck.is/project-sonar/), but in summary, the data is stored in a local MongoDB database which, when full, can fill up to 60gb. We then use [text indexes](https://docs.mongodb.com/manual/core/index-text/) to allow _extremely_ performant queries to be made.

Note on Project Sonar's data:  
6 days after I wrote my how-to guide, [Rapid7 switched to requiring you to apply](https://www.rapid7.com/blog/post/2022/02/10/evolving-how-we-share-rapid7-research-data-2/) to access Project Sonar's data. Except now, a few weeks later, it no longer requires an account again, and this time I cannot find any blog post etc. mentioning this change back, so I do not know if this is a permenant or temporary change.

Several of these can also be queried via the command line, i.e. `node queryArchiveDate.js example.com`

### Retreiving data

To retreive the data used for the above HTTP APIs, some of the modules send a request to an external API, while some query a local MongoDB database. To fetch the data used to fill up the MongoDB database, there exists two programs: One for parsing and inserting Project Sonar's data, and one for fetching, parsing and inserting malware/phishing data.

### Creating the HTTP APIs

To create and manage the HTTP APIs, there is a single program (`createAllAPI.js`) that opens up all the APIs when run. This program does almost nothing itself, and imports functionality from other modules to create the APIs (Notably `createHTTPServer.js`, which will take any function and open up an API for it on the given port.). This approach allows new APIs to be added with ease, and allows you to manage which modules are started.
