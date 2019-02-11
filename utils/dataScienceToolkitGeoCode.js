const { memoize } = require('lodash');
const http = require('http');
const baseURL = 'http://www.datasciencetoolkit.org/maps/api/geocode/json?sensor=false&address=';

async function geoCodeLocation(str = '') {
  const split = str.split(' ');
  const url = `${baseURL}${split.join('+')}`;
  await http.get(url, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      return data;
      console.log(data);
    });
  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
  return [];
}

exports.geoCode = memoize(geoCodeLocation);
