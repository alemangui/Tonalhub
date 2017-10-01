'use strict';

(function() {

	var Tonalhub = function(sounds, backgroundMusic) {
		this.sounds = sounds;
		this.backgroundMusic = backgroundMusic;
	};

	Tonalhub.prototype = {

		/** 
		 * Array of DOM elements representing the week.
		 */
		weekDomElements: document.getElementsByClassName('week'),

		/**
		 * Button used to play or stop the repo.
		 */	
		playButton: document.getElementById('playButton'),

		/**
		 * Div used to show errors.
		 */
		errorContainer: document.getElementById('errors'),

		/** 
		 * This interval will be the one used to play the sounds
		 * of the week's commits every 250 ms.
		 */
		interval: null,

		/** 
		 * Attaches the event listener to the play button.
		 */
		initialize: function() {
			var self = this;
			var repositoryInput = document.getElementById('repositoryInput');
			var userInput = document.getElementById('userInput');
			var user = this.getParameterByName('user');
			var repository = this.getParameterByName('repository');

			var eventHandler = function() {
				self.clearErrors();
				if (self.playButton.classList.contains('stop'))
					self.stop();
				else
					self.play();
			};

			this.playButton.addEventListener('click', eventHandler);

			repositoryInput.addEventListener('keypress', function(event) {
    			if (event.keyCode == 13)
    				eventHandler();
			});

			userInput.addEventListener('keypress', function(event) {
    			if (event.keyCode == 13)
    				eventHandler();
			});

			if (user && repository) {
				userInput.value = user;
				repositoryInput.value = repository;
				this.play();
			}
		},

		/** 
		 * Gets the user and repo names and calls the function 
		 * to get the commit activity.
		 */
		play: function() {
			var user = document.getElementById('userInput').value;
			var repo = document.getElementById('repositoryInput').value;

			if (!user || !repo) {
				this.displayError('Make sure you have both user and repository filled in.');
				return;
			}

			this.getCommitActivity(user, repo, this.onCommitActivityFetched, this.onCommitActivityError);
		},

		/** 
		 * Stops sounds and removes all visual grid cues
		 * from the current repo.
		 */
		stop: function() {
			this.stopAllSounds();
			this.removePlayingVisualCues();
			this.backgroundMusic && this.backgroundMusic.stop();
			this.playButton.classList.remove('stop');
			this.clearQueryString();
			if (this.interval)
				window.clearInterval(this.interval);
		},

		/** 
		 * Called once the commit activity is successfully fetched 
		 * from github's API
		 */
		onCommitActivityFetched: function(commitActivity) {
			this.playButton.classList.toggle('stop', true);
			this.toggleWaitingMode(false);

			this.normalize(commitActivity);
			this.displayCommitActivity(commitActivity);
			this.playCommitActivity(commitActivity);
		},

		/** 
		 * Called if the commit activity fetching fails. Retries the
		 * request if we get a 202, which means github is calculating 
		 * the response.
		 */
		onCommitActivityError: function(errorCode) {

			if (errorCode === 202) {
				window.setTimeout((function() { this.play(); }).bind(this), 500);
				return;
			}

			this.playButton.classList.toggle('stop', false);
			this.toggleWaitingMode(false);

			if (errorCode === 404)
				this.displayError('It seems like the user or repository doesn\'t exist :(');

			else if (errorCode === 500)
				this.displayError('Woops! There are some issues with GitHub\'s API');

			else if (errorCode === 403)
				this.displayError('We went over the query limit for the Github API :( Please try again later.');

			else
				this.displayError('Something went wrong with the request :(');
		},

		/** 
		 * Sometimes the year has 53 weeks, when that happens,
		 * we only take the 52 most recent ones.
		 */
		normalize: function(commitActivity) {
			if (commitActivity.length > 52) 
				commitActivity = commitActivity.slice(commitActivity.length - 52, 52);
		},

		/** 
		 * This fills the grid of the commit activity with the 
		 * active days in green.
		 */
		displayCommitActivity: function(commitActivity) {
			for (var i = 0; i < this.weekDomElements.length; i++) {
				var dayDomElements = this.weekDomElements[i].getElementsByClassName('day');
				var days = commitActivity[i].days;

				for (var j = 0; j < dayDomElements.length; j++) 
					dayDomElements[j].classList.toggle('active', days[j]);
			}
		},

		/** 
		 * Sets the interval up to play the sound for each week.
		 */
		playCommitActivity: function(commitActivity) {
			var index = 0;
			var self = this;

			this.backgroundMusic && this.backgroundMusic.play();

			this.interval = window.setInterval(function() {

				self.stopAllSounds();

				for (i = 0; i < self.weekDomElements.length; i++)
					self.weekDomElements[i].classList.remove('playing');

				if (index === commitActivity.length - 1) {
					index++;
					return;
				}

				if (index === commitActivity.length) {
					window.clearInterval(self.interval);
					self.backgroundMusic && self.backgroundMusic.stop();
					self.playButton.classList.toggle('stop', false);
					return;
				}

				var week = commitActivity[index];
				var soundsForWeek = self.getSoundsForWeek(week);

				self.weekDomElements[index].classList.add('playing');

				for (var i = 0; i < soundsForWeek.length; i++)
					soundsForWeek[i].play();

				index++;
			}, 250);
		},

		/** 
		 * If there are any sounds playing, they will be stopped.
		 */
		stopAllSounds: function() {
			
			for (var i = 0; i < this.sounds.length; i++)
				this.sounds[i].stop();
		},

		/** 
		 * Removes the green dots in the week grid as well as the 
		 * larger dots in case the repo is being played.
		 */
		removePlayingVisualCues: function() {
			for (i = 0; i < this.weekDomElements.length; i++)
					this.weekDomElements[i].classList.remove('playing');

			for (var i = 0; i < this.weekDomElements.length; i++) {
				var dayDomElements = this.weekDomElements[i].getElementsByClassName('day');

				for (var j = 0; j < dayDomElements.length; j++) 
					dayDomElements[j].classList.remove('active');
			}
		},

		/** 
		 * Returns the sounds that should be played given a specific
		 * week. For example, a full week will play all 7 sounds, whereas
		 * an empty week will play none.
		 */
		getSoundsForWeek: function(week) {
			var soundsForWeek = [];

			for (var i = 0; i < this.sounds.length; i++)
				if (week.days[i])
					soundsForWeek.push(this.sounds[i]);
			
			return soundsForWeek;
		},

		/** 
		 * Performs the AJAX request to get the commit activity from 
		 * github's API.
		 */
		getCommitActivity: function(user, repository, successCallback, errorCallback) {
			this.toggleWaitingMode(true);
			var nextUrl = window.location.toString();
			nextUrl = this.updateQueryString('user', user, nextUrl);
			nextUrl = this.updateQueryString('repository', repository, nextUrl);

			window.history.replaceState(null, '', nextUrl);

			var url = 'https://alemangui.pythonanywhere.com/api/' + user + '/' + repository;
			var httpRequest = new XMLHttpRequest();
			var self = this;

			httpRequest.onreadystatechange = function() {
				if (httpRequest.readyState !== XMLHttpRequest.DONE) 
					return;

				if (httpRequest.status === 200)
					(successCallback.bind(self))(JSON.parse(httpRequest.response));
				else
					(errorCallback.bind(self))(httpRequest.status);
			};

			httpRequest.open('GET', url, true);
			httpRequest.send(null);
		},

		toggleWaitingMode: function(waiting) {
			if (waiting) {
				this.playButton.disabled = true;
			} else {
				this.playButton.disabled = false;
			}
		},

		displayError: function(error) {
			this.errorContainer.innerHTML = error;
		},

		clearErrors: function() {
			this.errorContainer.innerHTML =  '';
		},

		/**
		 * Taken from: http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
		 */
		getParameterByName: function(name) {
			name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
			var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
				results = regex.exec(location.search);
			return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
		},

		/**
		 * Taken from: http://stackoverflow.com/questions/5999118/add-or-update-query-string-parameter
		 */
		updateQueryString: function(key, value, url) {
			if (!url) url = window.location.href;
			var re = new RegExp("([?&])" + key + "=.*?(&|#|$)(.*)", "gi"),
				hash;

			if (re.test(url)) {
				if (typeof value !== 'undefined' && value !== null)
					return url.replace(re, '$1' + key + "=" + value + '$2$3');
				else {
					hash = url.split('#');
					url = hash[0].replace(re, '$1$3').replace(/(&|\?)$/, '');
					if (typeof hash[1] !== 'undefined' && hash[1] !== null) 
						url += '#' + hash[1];
					return url;
				}
			}
			else {
				if (typeof value !== 'undefined' && value !== null) {
					var separator = url.indexOf('?') !== -1 ? '&' : '?';
					hash = url.split('#');
					url = hash[0] + separator + key + '=' + value;
					if (typeof hash[1] !== 'undefined' && hash[1] !== null) 
						url += '#' + hash[1];
					return url;
				}
				else
					return url;
			}
		},

		clearQueryString: function() {
			var url = window.location.toString().split('?')[0];
			window.history.replaceState(null, '', url);
		}
	};

	var backgroundPath = Dolby.checkDDPlus() ? './audio/background_Dolby.mp4' : './audio/background.m4a';

	var tonalhub = new Tonalhub([
		createSynthSound(880.00),
		createSynthSound(659.25),
		createSynthSound(523.25),
		createSynthSound(440.00),
		createSynthSound(329.63),
		createSynthSound(220.00),
		createSynthSound(164.81)
	],
		new Pizzicato.Sound({ source: 'file', options: { path: backgroundPath, loop: true, volume: 1.4 }})
	);

	function createSynthSound(frequency) {
		return new Pizzicato.Sound({ source: 'wave', options: { frequency: frequency, sustain: 0.2, volume: 0.4 } });
	}

	tonalhub.initialize();
})();