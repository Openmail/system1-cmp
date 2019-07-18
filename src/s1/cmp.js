// __cmp('setConsentUiCallback', callback) QUANTCAST
import 'core-js/fn/array/find-index';
import 'core-js/fn/array/filter';
import 'core-js/fn/array/from';
import 'core-js/fn/array/find';
import 'core-js/fn/array/map';
import 'core-js/fn/object/keys';

import cmp from '../loader';
import {init, getStore} from '../lib/init';
import log from '../lib/log';
import {readCookie, writeCookie} from "../lib/cookie/cookie";

const GDPR_OPT_IN_COOKIE = "gdpr_opt_in";
const GDPR_OPT_IN_COOKIE_MAX_AGE = 33696000;

const defaultConfig = {
	logging: false,
	shouldAutoConsent: false,
	shouldAutoConsentWithFooter: false,
};

const addLocatorFrame = () => {
	if (!window.frames['__cmpLocator']) {
		if (document.body) {
			const frame = document.createElement('iframe');
			frame.style.display = 'none';
			frame.name = '__cmpLocator';
			document.body.appendChild(frame);
		}
		else {
			setTimeout(addLocatorFrame, 5);
		}
	}
};

const addPostmessageReceiver = (cmp) => {
	const onReceiveMessage = (event) => {
		const data = event && event.data && event.data.__cmpCall;
		if (data) {
			const {command, parameter} = data;
			cmp.call(this, command, parameter);
		}
	};

	const listen = window.attachEvent || window.addEventListener;
	listen('message', onReceiveMessage, false);
};

const initialize = (config, callback) => {
	init(config, cmp).then(() => {
		addPostmessageReceiver(cmp);
		addLocatorFrame();

		cmp('addEventListener', 'onSubmit', () => {
			checkConsent();
		});

		checkConsent({
			callback,
			config
		});
	});
};

const checkHasConsentedAll = ({ purposeConsents } = {}) => {
	const hasAnyPurposeDisabled = Object.keys(purposeConsents).find(key => {
		return purposeConsents[key] === false;
	});
	return !hasAnyPurposeDisabled;
};

const checkConsent = ({
	callback = () => {},
	config
} = {}) => {
	let errorMsg = "";
	if (!cmp.isLoaded) {
		errorMsg = 'CMP failed to load';
		log.error(errorMsg);
		handleConsentResult({
			errorMsg
		});
	} else if (!window.navigator.cookieEnabled) {
		errorMsg = 'Cookies are disabled. Ignoring CMP consent check';
		log.error(errorMsg);
		handleConsentResult({
			errorMsg
		});
	} else {
		cmp('getVendorList', null, vendorList => {
			cmp('getVendorConsents', null, vendorConsentData => {
				handleConsentResult({
					vendorList,
					vendorConsentData,
					callback,
					config
				});
			});
		});
	}
};

const handleConsentResult = ({
	vendorList = {},
	vendorConsentData = {},
	callback,
	config,
	errorMsg = ""
}) => {
	const hasConsentedCookie = readCookie(GDPR_OPT_IN_COOKIE);
	const { vendorListVersion: listVersion } = vendorList;
	const { created, vendorListVersion } = vendorConsentData;

	if (!created) {
		const {shouldAutoConsent, shouldAutoConsentWithFooter} = config || {};
		if (shouldAutoConsent || shouldAutoConsentWithFooter) {
			return (() => {
				log.debug("CMP: auto-consent to all conditions.");
				cmp('acceptAllConsents');
				if (shouldAutoConsentWithFooter) {
					const store = getStore();
					if (store) {
						store.toggleFooterShowing(true);
					}
				}
				checkConsent({
					callback
				});
			})();
		}

		errorMsg = 'No consent data found. Show consent tool';
	}

	// if (vendorListVersion !== listVersion) {
	// 	errorMsg = `Consent found for version ${vendorListVersion}, but received vendor list version ${listVersion}. Showing consent tool`;
	// }
	log.debug("FIXME: Unify pubVendorVersion and globalVendorVersion", listVersion, vendorListVersion);
	if (errorMsg) {
		log.debug(errorMsg);
	}

	// if (!listVersion) {
	// 	errorMsg =
	// 		'Could not determine vendor list version. Not showing consent tool';
	// }

	if (callback && typeof callback === "function") {
		// store as 1 or 0
		const hasConsented = checkHasConsentedAll(vendorConsentData);
		if (created) {
			writeCookie(GDPR_OPT_IN_COOKIE, hasConsented ? "1" : "0", GDPR_OPT_IN_COOKIE_MAX_AGE);
		}
		const consent = {
			consentRequired: true,
			gdprApplies: true,
			hasConsented,
			vendorList,
			vendorConsentData,
			errorMsg
		};

		callback.call(this, consent);

		if (created && hasConsented !== hasConsentedCookie) {
			cmp.notify('onConsentChanged', consent);
		}
	}
};

// initialize CMP
(() => {
	const initIndex = cmp.commandQueue && cmp.commandQueue.findIndex(({ command }) => {
		return command === 'init';
	});

	// 1. initialize call was queued from global scope (inline cmpLoader)
	if (initIndex >= 0 && cmp.commandQueue[initIndex]) {
		const [{ parameter: config, callback }] = cmp.commandQueue.splice(
			initIndex,
			1
		); // remove "init" from command list because it doesn't exist
		initialize(config, callback);

		// 2. initialize call never queued, so initialize with default Config
	} else {
		initialize(defaultConfig, result => {
			const { errorMsg } = result;
			if (errorMsg) {
				log.debug(errorMsg);
				cmp('showConsentTool');
			}
		});
	}
})();
