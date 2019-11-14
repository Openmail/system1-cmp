
export const deleteAllCookies = (domain = "") => {
	let cookies = document.cookie.split(";");

	for (let i = 0; i < cookies.length; i++) {
		let cookie = cookies[i];
		let eqPos = cookie.indexOf("=");
		let name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
		document.cookie = name + `=;${domain}expires=Thu, 01 Jan 1970 00:00:00 GMT`;
	}
};

export const setCookue = (name = "", value ="", expires = 30000, path = "/") => {
	document.cookie = `${name}=${value}; expires=${(Date.now() + expires)}; path=${path}`;
};
