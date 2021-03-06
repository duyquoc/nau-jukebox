/* © 2017 NauStud.io
 * @author Thanh Tran, Tung Tran, Tw
 */
/*global Songs:true, AppStates:true, Users:true, moment*/
import { getSongInfoNct } from '../imports/parsers/getSongInfoNct.js';
import { getSongInfoZing } from '../imports/parsers/getSongInfoZing.js';
import { getSongInfoSoundcloud } from '../imports/parsers/getSongInfoSoundcloud.js';
import { getSongInfoYouTube } from '../imports/parsers/getSongInfoYouTube.js';

Meteor.startup(() => {
	// migrate database
	Migrations.migrateTo('latest');

	// On server startup, create initial appstates if the database is empty.
	if (AppStates.find({key: 'playingSongs'}).count() === 0) {
		//first time running
		AppStates.insert({
			key: 'playingSongs',
			songs: []
		});
		console.log('Insert AppStates.playingSongs key');
	}

	Meteor.setInterval(() => {
		const passAMinute = moment().add(-90, 'seconds').toDate();
		Users.update({lastModified: {$lt: passAMinute}}, {
			$set: {
				isOnline: false
			}
		}, {multi: true});
		console.log('Checking online status was run at: ', new Date());
	}, 90000);
});

Meteor.methods({

	getSongInfo(songurl, authorId) {
		// Set up a future for async callback sending to clients
		let songInfo;

		if (String(songurl).includes('nhaccuatui')) {
			console.log('Getting NCT song info');
			songInfo = getSongInfoNct(songurl);
		} else if (String(songurl).includes('mp3.zing')) {
			console.log('Getting Zing song info');
			songInfo = getSongInfoZing(songurl);
		} else if (String(songurl).includes('soundcloud')) {
			console.log('Getting Soundclound song info');
			songInfo = getSongInfoSoundcloud(songurl);
		} else if (String(songurl).includes('youtube')) {
			console.log('Getting YouTube song info');
			songInfo = getSongInfoYouTube(songurl);
		}

		Meteor.call('updateStatus', authorId, (err, result) => {
			console.log('updateStatus', authorId, err, result);
		});

		if (songInfo && songInfo.streamURL) {
			songInfo.author = authorId;
			songInfo.searchPattern = `${songInfo.name.toLowerCase()} - ${songInfo.artist.toLowerCase()}`;
			return Songs.insert(songInfo);
		} else {
			//songInfo is error object
			throw new Meteor.Error(403, songInfo ? songInfo.error : 'Invalid URL');
		}
	},

	changeHost(userId) {
		console.log('changeHost', userId);
		// switch all users isHost off
		Users.update({}, {$set: {isHost: false}}, {multi: true}, () => {
			// then switch sHost
			Users.update(userId, {
				$set: {
					isHost: true,
					lastModified: new Date()
				}
			});
		});
	},

	updateStatus(userId) {
		return Users.update(userId, {
			$set: {
				isOnline: true,
				lastModified: new Date()
			}
		});
	},

	naucoinPay(userId, amount) {
		const u = Users.findOne(userId);
		const oldBalance = u.balance || 0;
		const newBalance = oldBalance + parseFloat(amount);

		return Users.update(u._id, {
			$set: {
				balance: newBalance
			}
		});
	}
});

Meteor.publish('Meteor.users.public', () => {
	const options = {
		fields: { isHost: 1, isOnline: 1, balance: 1 }
	};
	return Meteor.users.find({}, options);
});

Meteor.publish('userData', function () {
	if (this.userId) {
		return Meteor.users.find({ _id: this.userId }, {
			fields: { isHost: 1, isOnline: 1, balance: 1 }
		});
	} else {
		this.ready();
	}
});
