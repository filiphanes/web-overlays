export class BroadcastBroker {
	constructor(options) {
		this.channel = new BroadcastChannel(options.broadcast)
		if (options.update) {
			this.channel.onmessage = (event) => {
				for (const [key, value] of Object.entries(event.data)) {
					options.update(key, value);
				}
			}
		}
	}
	
	send(key, value) {
		this.channel.postMessage({[key]: value})
	}
}
