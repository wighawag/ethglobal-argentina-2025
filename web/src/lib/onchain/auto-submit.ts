import { epochInfo, time, timeConfig } from '$lib/time';
import { localState } from '$lib/private/localState';
import type { Unsubscriber } from 'svelte/store';

export function createAutoSubmitter() {
	let highFreqInterval: NodeJS.Timeout | null = null;
	let startTimeout: NodeJS.Timeout | null = null;

	const interval = (timeConfig.REVEAL_PHASE_DURATION * 1000) / 30;

	// Named function for high-frequency commit checking
	function performHighFrequencyCommitCheck() {
		const now = time.now();
		const currentEpochInfo = epochInfo.fromTime(now);
		const currentLocalData = localState.value;

		if (!currentLocalData.signer || !currentLocalData.avatar) {
			clearTimers();
			return false;
		}

		// High-frequency check for commit
		if (
			currentEpochInfo.isCommitPhase &&
			!currentLocalData.avatar.submission &&
			!(currentLocalData.avatar.exiting && currentLocalData.avatar.actions.length == 0) &&
			currentLocalData.avatar.epoch == currentEpochInfo.currentEpoch
		) {
			localState.commit({ pollingInterval: interval });
			clearTimers();
			return true;
		} else {
			// Stop checking if conditions no longer met
			clearTimers();
			return false;
		}
	}

	// Named function for high-frequency reveal checking
	function performHighFrequencyRevealCheck() {
		const now = time.now();
		const currentEpochInfo = epochInfo.fromTime(now);
		const currentLocalData = localState.value;

		if (!currentLocalData.signer || !currentLocalData.avatar) {
			clearTimers();
			return false;
		}

		if (!currentEpochInfo.isCommitPhase) {
			if (
				currentLocalData.avatar.submission &&
				currentLocalData.avatar.submission.commit.epoch == currentEpochInfo.currentEpoch
			) {
				if (
					!currentLocalData.avatar.submission.reveal ||
					currentLocalData.avatar.submission.reveal.epoch < currentEpochInfo.currentEpoch
				) {
					localState.reveal({ pollingInterval: interval });
					clearTimers();
					return true;
				}
			} else {
				// Handle avatar removal if commit was not performed
				if (
					currentLocalData.avatar.epoch == currentEpochInfo.currentEpoch &&
					currentLocalData.avatar.actions.length > 0 &&
					currentLocalData.avatar.actions[currentLocalData.avatar.actions.length - 1].type ==
						'enter'
				) {
					localState.removeAvatar();
				}
				// Stop checking if conditions no longer met
				clearTimers();
				return false;
			}
		} else {
			// Stop checking if not in reveal phase anymore
			clearTimers();
			return false;
		}
		return false;
	}

	function startHighFrequencyCommitCheck(delayMs: number) {
		console.debug(`Starting commit high-frequency check in ${delayMs}ms`);

		startTimeout = setTimeout(() => {
			// Execute immediately first
			performHighFrequencyCommitCheck();

			// Then continue with interval for subsequent checks
			highFreqInterval = setInterval(performHighFrequencyCommitCheck, interval); // Check every 100ms for precise timing
		}, delayMs);
	}

	function startHighFrequencyRevealCheck(delayMs: number) {
		console.debug(`Starting reveal high-frequency check in ${delayMs}ms`);

		startTimeout = setTimeout(() => {
			// Execute immediately first
			performHighFrequencyRevealCheck();

			// Then continue with interval for subsequent checks
			highFreqInterval = setInterval(performHighFrequencyRevealCheck, interval); // Check every 100ms for precise timing
		}, delayMs);
	}

	let unsubscribe: Unsubscriber;
	function start() {
		// Use the existing time subscription with high-frequency checking
		unsubscribe = time.subscribe(($time) => {
			const $epochInfo = epochInfo.fromTime($time.value);

			localState.update($epochInfo.currentEpoch);

			const localData = localState.value;
			if (!localData.signer) {
				clearTimers();
				return;
			}
			if (!localData.avatar) {
				clearTimers();
				return;
			}

			// For commit: check if we need to start high-frequency checking 1 second before commit time
			const timeToCommit = $epochInfo.timeLeftForCommitEnd - timeConfig.COMMIT_TIME_ALLOWANCE;

			const shouldStartCommitCheck =
				$epochInfo.isCommitPhase &&
				!localData.avatar.submission &&
				localData.avatar.epoch == $epochInfo.currentEpoch &&
				timeToCommit <= 1.0; // Within 1 second of commit time

			// For reveal: check if we need to start high-frequency checking 1 second before reveal time
			const shouldStartRevealCheck =
				!shouldStartCommitCheck &&
				localData.avatar.submission &&
				localData.avatar.submission.commit.epoch == $epochInfo.currentEpoch &&
				(!localData.avatar.submission.reveal ||
					localData.avatar.submission.reveal.epoch < $epochInfo.currentEpoch) &&
				(!$epochInfo.isCommitPhase || $epochInfo.timeLeftForCommitEnd <= 1.0); // Within 1 second of reveal time

			// Start high-frequency checking for commit if needed
			if (shouldStartCommitCheck && !highFreqInterval && !startTimeout) {
				const delayUntilCommitCheck = Math.max(0, (timeToCommit + 0.1) * 1000); // Start at commit time + 0.1
				startHighFrequencyCommitCheck(delayUntilCommitCheck);
			}
			// Start high-frequency checking for reveal if needed
			else if (shouldStartRevealCheck && !highFreqInterval && !startTimeout) {
				const delayUntilRevealCheck = $epochInfo.isCommitPhase
					? $epochInfo.timeLeftForCommitEnd + 0.1
					: 0.1;
				startHighFrequencyRevealCheck(delayUntilRevealCheck * 1000);
			}
			// Clear timers if not in any critical window
			else if (!shouldStartCommitCheck && !shouldStartRevealCheck) {
				clearTimers();
			}
		});

		return () => {
			unsubscribe();
			clearTimers();
		};
	}

	function stop() {
		unsubscribe();
		clearTimers();
	}

	function clearTimers() {
		if (highFreqInterval) {
			clearInterval(highFreqInterval);
			highFreqInterval = null;
		}
		if (startTimeout) {
			clearTimeout(startTimeout);
			startTimeout = null;
		}
	}

	return {
		start,
		stop
	};
}
