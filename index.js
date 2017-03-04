'use strict';
const request = require('request'),
	cheerio = require('cheerio'),
	path = require('path'),
	moment = require('moment');

function parseTimeRange(str) {
	let to = null, from = null;
	const regex = /([0-9]{1,2}\.[0-9]{1,2}\.(([0-9]){4})*|([0-9]){4})/g;

	if (str.length) {
		const found = str.match(regex);
		const foundLen = found.length;

		if (foundLen == 1) {
			from = moment(found[0], 'YYYY');
			to = moment(from).endOf('year');
		} else if (foundLen == 2) {
			to = moment(found[1], 'D.M.YYYY');
			from = moment(found[0], 'D.M.' + to.year());
		}

		if (to && from) {
			return {
				from: from.format('YYYY-MM-DD 00:00:00'),
				to: to.format('YYYY-MM-DD 23:59:59')
			};
		}
	}

	return {from, to};
}

function scrapUrl(url) {
	return new Promise((resolve) => {
		request.get(url, (err, res, body) => {
			if (!err && res.statusCode == 200) {
				const $ = cheerio.load(body);

				const title = $('title').text().trim().split(' - ')[0];

				const content = $('.list-page').contents();
				let data = [];
				let index = -1;

				const filterTags = ['br', 'div'];

				for (let i = 0; i < content.length; i++) {
					const element = content[i];

					if (element.name === 'hr' && element.attribs.class === 'dotted') {
						index++;
					} else if (index > -1 && element.type !== 'text' && filterTags.indexOf(element.name) < 0) {
						const elementFirstChildren = element.children[0];

						if (element.name === 'p' && elementFirstChildren) {
							const href = elementFirstChildren.attribs.href;
							if (path.extname(href) === '.pdf') {
								if (!data[index]) {
									data[index] = {
										title: title,
										source_url: url,
										descr: '',
										datetime_begin: null,
										datetime_end: null,
										file_orig: href,
									};
								}
							}
						} else if (element.name === 'ul' && data[index]) {
							const listChildren = element.children;

							for (let item of listChildren) {
								if (item.name === 'li') {
									let text = item.children[0];
									if (text) {
										data[index].descr += text.data.replace('Leták je platný', '').replace(/[\n\t]/g, ' ');

										if (!data[index].datetime_begin || !data[index].datetime_end) {
											const timerange = parseTimeRange(data[index].descr);
											data[index].datetime_begin = timerange.from;
											data[index].datetime_end = timerange.to;
										}
									}
								}
							}
						}
					}
				}

				resolve(data);
			}
		});
	});
}


const url = 'https://www.asko-nabytek.cz/katalog-letak-asko';
scrapUrl(url).then((data) => {
	console.log(data);
});
