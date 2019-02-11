const { get, isNil, isArray, partialRight } = require('lodash');
const { parseDate } = require('chrono-node');
const { getUSCityLocation } = require('../utils/geoCodeCity');

/**
 * remove the citation brackets e.g. [145]
 * https://regex101.com/r/JTEb0z/1
 * TODO: parse the citation links and parse them to a new field so we can add
 * TODO:   a direct link to any records
 * @param str {string} - input string
 * @param regex - regex to use to parse
 * @return {string|void}
 */
function removeCitationBrackets(str, regex = /\[.+?\]\s*/gm) {
  return str.replace(regex, '');
}

/**
 * remove (including perpetrator) from some entries to retrieve numeric values
 * and set booleans to indicate whether the perp died or was injured in the shooting
 * https://regex101.com/r/4TLSb2/1
 * @param str {string} input string
 * @param regex - regex to use to parse
 * @return {{found_perpetrator: boolean, replaced: (string|void|never)}}
 */
function removePerpetratorInsideParens(str, regex = / \(.+?perpetrator\)\s*/gm) {
  return {
    replaced: str.replace(regex, ''),
    found_perpetrator: regex.exec(str) !== null,
  };
}

/**
 * School shootings all years
 * Collection of props to pass to ../parser.parseJSONFrame() to select items on a given page
 * and convert them to objects using the jsonframe-cheerio library
 * @type {{
 *    selector: string representing the target selector to target on the html page,
 *    postProcessor: (function(*=): *) function to post process the json response,
 *    url: string representing the url of the page,
 *    frame: object representing the shape of the output json according to jsonframe spec,
 *    scrapeOptions: object representing the options of the jsonframe.scrape() function,
 * }}
 */
exports.schoolShootings = {
  url: 'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States',
  selector: '#bodyContent',
  frame: {
    school_shootings: {
      _s: ".wikitable tbody tr",  // the selector
      _d: [{  // allow you to get an array of data, not just the first item
        "date": "td:nth-child(1)",
        "location": "td:nth-child(2)",
        "deaths": "td:nth-child(3)",
        "injuries": "td:nth-child(4)",
        "description": "td:nth-child(5)",
      }]
    }
  },
  scrapeOptions: {},
  postProcessor: function processSchoolShootingsJSON(unparsed) {
    const parseArray = get(unparsed, 'school_shootings');
    return isArray(parseArray)
    ? parseArray.reduce((acc, { date, deaths, injuries, description, location, ...rest }) => {
      if (
        !isNil(description)
        && !isNil(date)
        && !isNil(deaths)
        && !isNil(injuries)
      ) {
        // remove (including perpetrator) from some entries to retrieve numeric values
        // and include a boolean indicating the fate of the perpetrator
        const {
          replaced: parseDeaths,
          found_perpetrator: perpetrator_died,
        } = removePerpetratorInsideParens(deaths);
        const {
          replaced: parseInjuries,
          found_perpetrator: perpetrator_injured,
        } = removePerpetratorInsideParens(injuries);

        acc.push({
          ...rest,
          date: parseDate(date),
          deaths: parseDeaths,
          perpetrator_died,
          injuries: parseInjuries,
          perpetrator_injured,
          description: removeCitationBrackets(description),
          location,
          geocode_results: {
            ...getUSCityLocation(location, true),
          }
        });
      }
      return acc;
    }, [])
    : unparsed;
  }
};

/**
 * Mass shootings pre 2018
 * Collection of props to pass to ../parser.parseJSONFrame() to select items on a given page
 * and convert them to objects using the jsonframe-cheerio library
 * @type {{
 *    selector: string representing the target selector to target on the html page,
 *    postProcessor: (function(*=): *) function to post process the json response,
 *    url: string representing the url of the page,
 *    frame: object representing the shape of the output json according to jsonframe spec,
 *    scrapeOptions: object representing the options of the jsonframe.scrape() function,
 * }}
 */
exports.massShootingsPre2018 = {
  url: 'https://en.wikipedia.org/wiki/List_of_mass_shootings_in_the_United_States',
  selector: '#bodyContent',
  frame: {
    mass_shootings_pre_2018: {
      _s: ".wikitable tbody tr",  // the selector
      _d: [{  // allow you to get an array of data, not just the first item
        "date": "td:nth-child(1)",
        "location": "td:nth-child(2)",
        "deaths": "td:nth-child(3)",
        "injuries": "td:nth-child(4)",
        "description": "td:nth-child(6)",
      }]
    }
  },
  scrapeOptions: {},
  postProcessor: function processMassShootingsJSON(unparsed) {
    const firstDayOf2018 = new Date(parseDate("January 1, 2018 12:00 am"));
    const parseArray = get(unparsed, 'mass_shootings_pre_2018');
    return isArray(parseArray)
      ? parseArray.reduce((acc, { date, deaths, injuries, description, location, ...rest }) => {
        const dateFixed = parseDate(date);
        if (
          !isNil(description)
          && !isNil(date)
          && (new Date(dateFixed)) < firstDayOf2018
          && !isNil(deaths)
          && !isNil(injuries)
        ) {
          acc.push({
            ...rest,
            date: dateFixed,
            // deaths, injuries, description,
            deaths: removeCitationBrackets(deaths),
            injuries: removeCitationBrackets(injuries),
            description: removeCitationBrackets(description),
            location,
            geocode_results: {
              ...getUSCityLocation(location, true),
            }
          });
        }
        return acc;
      }, [])
      : unparsed;
  }
};


/**
 * processor function for single year mass shootings (doesn't filter by year, just hits a given page)
 * @param unparsed - returned json
 * @param frameRootNodeKey - key of the root node in the json to look for an array within
 * @return {object} representing the parsed json
 */
function processSingleYearMassShootingsJSON(unparsed, frameRootNodeKey) {
  const parseArray = get(unparsed, frameRootNodeKey);
  return isArray(parseArray)
    ? parseArray.reduce((acc, { date, deaths, injuries, description, location, ...rest }) => {
      const dateFixed = parseDate(date);
      if (
        !isNil(description)
        && !isNil(date)
        && !isNil(deaths)
        && !isNil(injuries)
      ) {
        acc.push({
          ...rest,
          date: dateFixed,
          // deaths, injuries, description,
          deaths: removeCitationBrackets(deaths),
          injuries: removeCitationBrackets(injuries),
          description: removeCitationBrackets(description),
          location,
          geocode_results: {
            ...getUSCityLocation(location, true),
          }
        });
      }
      return acc;
    }, [])
    : unparsed;
}

/**
 * Mass shootings 2018
 * Collection of props to pass to ../parser.parseJSONFrame() to select items on a given page
 * and convert them to objects using the jsonframe-cheerio library
 * @type {{
 *    selector: string representing the target selector to target on the html page,
 *    postProcessor: (function(*=): *) function to post process the json response,
 *    url: string representing the url of the page,
 *    frame: object representing the shape of the output json according to jsonframe spec,
 *    scrapeOptions: object representing the options of the jsonframe.scrape() function,
 * }}
 */
exports.massShootings2018 = {
  url: 'https://en.wikipedia.org/wiki/List_of_mass_shootings_in_the_United_States_in_2018',
  selector: '#bodyContent',
  frame: {
    mass_shootings_2018: {
      _s: ".wikitable tbody tr",  // the selector
      _d: [{  // allow you to get an array of data, not just the first item
        "date": "td:nth-child(1)",
        "location": "td:nth-child(2)",
        "deaths": "td:nth-child(3)",
        "injuries": "td:nth-child(4)",
        "description": "td:nth-child(6)",
      }]
    }
  },
  scrapeOptions: {},
  postProcessor: partialRight(processSingleYearMassShootingsJSON, 'mass_shootings_2018')
};

/**
 * Mass shootings 2019
 * Collection of props to pass to ../parser.parseJSONFrame() to select items on a given page
 * and convert them to objects using the jsonframe-cheerio library
 * @type {{
 *    selector: string representing the target selector to target on the html page,
 *    postProcessor: (function(*=): *) function to post process the json response,
 *    url: string representing the url of the page,
 *    frame: object representing the shape of the output json according to jsonframe spec,
 *    scrapeOptions: object representing the options of the jsonframe.scrape() function,
 * }}
 */
exports.massShootings2019 = {
  url: 'https://en.wikipedia.org/wiki/List_of_mass_shootings_in_the_United_States_in_2019',
  selector: '#bodyContent',
  frame: {
    mass_shootings_2019: {
      _s: ".wikitable tbody tr",  // the selector
      _d: [{  // allow you to get an array of data, not just the first item
        "date": "td:nth-child(1)",
        "location": "td:nth-child(2)",
        "deaths": "td:nth-child(3)",
        "injuries": "td:nth-child(4)",
        "description": "td:nth-child(6)",
      }]
    }
  },
  scrapeOptions: {},
  postProcessor: partialRight(processSingleYearMassShootingsJSON, 'mass_shootings_2019')
};


