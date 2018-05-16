/* eslint-disable max-nested-callbacks */
/* eslint-disable no-eval */

import { expect } from 'chai';
import fs from 'fs';
// import pubvendorsStub
// import vendorlistStub
const fakeScriptSrc = './fake-loader-src.js';

describe.skip('cmpLoader as script', () => {
	let appendChild;

	beforeEach(() => {
		appendChild = window.document.body.appendChild = jest.fn(() => {});
		const content = fs.readFileSync('./src/loader.js');
		eval(content + '; global.cmp = cmp');
	});

	afterEach(() => {
		eval('; global.cmp = null; cmp = null;');
		jest.restoreAllMocks();
		appendChild.mockRestore();
	});

	// 1.
	it('loads cmp as script tag', done => {
		expect(global.cmp).to.not.be.undefined;
		expect(typeof global.cmp).to.equal('function');
		done();
	});

	it('warns when no scriptSrc provided', done => {
		const log = jest.spyOn(window.console, 'log');

		global.cmp('init', {
			logging: true
		});
		expect(log.mock.calls).to.have.length(1);
		expect(log.mock.calls[0][0]).to.contain('Provide src');
		log.mockRestore();
		done();
	});

	it('warns when country code not needed for GDPR', done => {
		const log = jest.spyOn(window.console, 'log');
		global.cmp('init', {
			scriptSrc: fakeScriptSrc,
			countryCode: 'AA',
			logging: true
		});

		expect(log.mock.calls).to.have.length(1);
		expect(log.mock.calls[0][0]).to.contain(
			'Country Code provided does not need CMP'
		);

		log.mockRestore();
		done();
	});

	it('appends scriptSrc if countryCode and scriptSrc provided', done => {
		const createElement = jest.spyOn(window.document, 'createElement');

		global.cmp('init', {
			scriptSrc: fakeScriptSrc,
			countryCode: 'ES'
		});

		expect(createElement.mock.calls).to.have.length(1);
		expect(createElement.mock.calls[0][0]).to.contain('script');
		expect(appendChild.mock.calls).to.have.length(1);

		createElement.mockRestore();
		done();
	});

	it('warns on multiple init calls', done => {
		const log = jest.spyOn(window.console, 'log');
		global.cmp('init', {
			scriptSrc: fakeScriptSrc,
			countryCode: 'ES',
			logging: true
		});

		global.cmp('init', {
			scriptSrc: fakeScriptSrc,
			countryCode: 'ES',
			logging: true
		});

		expect(log.mock.calls).to.have.length(1);
		expect(log.mock.calls[0][0]).to.contain('Only call init once');

		log.mockRestore();
		done();
	});

	describe('Complete CMP loading with reimport of loader shim', () => {
		let appendChild;

		beforeEach(() => {
			window.fetch = jest.fn().mockImplementation(src => {
				// console.log('fetch', d);
				// pubvendores
				// https://vendorlist.consensu.org/vendorlist.json
				return Promise.resolve(src);
			});
			appendChild = window.document.body.appendChild = jest.fn(() => {
				require('../s1/cmp'); // need to require this here because there is no built version that we can script load
			});
		});

		afterEach(() => {
			appendChild.mockRestore();
			jest.resetModules();
		});

		it('triggers isLoaded after loading complete CMP', done => {
			global.cmp('init', {
				scriptSrc: fakeScriptSrc,
				countryCode: 'ES'
			});

			global.cmp('addEventListener', 'isLoaded', result => {
				expect(result.event).to.equal('isLoaded');
				done();
			});
		});

		it('triggers callback on init after loading complete CMP', done => {
			global.cmp(
				'init',
				{
					scriptSrc: fakeScriptSrc,
					countryCode: 'ES'
				},
				() => {
					const init = global.cmp.commandQueue.find(({ command }) => {
						return command === 'init';
					});
					expect(init).to.be.undefined;
					done();
				}
			);
		});

		it('triggers callback on init and isLoaded after loading complete CMP', done => {
			let count = 0;
			const callback = () => {
				count++;
				if (count === 2) {
					done();
				}
			};

			global.cmp(
				'init',
				{
					scriptSrc: fakeScriptSrc,
					countryCode: 'ES'
				},
				callback
			);

			global.cmp('addEventListener', 'isLoaded', callback);
		});
	});
});
