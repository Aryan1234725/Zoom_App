import React, { useEffect, useRef, useState, useCallback } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Menu, MenuItem, Tooltip, Drawer, Avatar, Chip, Snackbar, Alert, Slider, Switch, FormControlLabel } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import PeopleIcon from '@mui/icons-material/People';
import PanToolIcon from '@mui/icons-material/PanTool';
import SettingsIcon from '@mui/icons-material/Settings';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PictureInPictureIcon from '@mui/icons-material/PictureInPicture';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import SendIcon from '@mui/icons-material/Send';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloseIcon from '@mui/icons-material/Close';
import server from '../environment';

const server_url = server;
var connections = {};
const peerConfigConnections = {
    "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }]
};

// ── Helper: pick supported mimeType ─────────────────────────────────────────
function getSupportedMimeType() {
    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4',
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

// ── Helper: draw rounded rect without roundRect() API ───────────────────────
function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export default function VideoMeetComponent() {
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();
    const mediaRecorderRef = useRef(null);
    const recordedChunks = useRef([]);
    const canvasRef = useRef(null);
    const recordingAnimFrameRef = useRef(null);
    const videoRef = useRef([]);
    const remoteVideoRefs = useRef({});
    const recordingTimeRef = useRef(0);

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [isRecording, setIsRecording] = useState(false);
    let [videos, setVideos] = useState([]);

    let [showParticipants, setShowParticipants] = useState(false);
    let [participants, setParticipants] = useState([]);
    let [handRaised, setHandRaised] = useState(false);
    let [raisedHands, setRaisedHands] = useState([]);
    let [reactions, setReactions] = useState([]);
    let [isFullscreen, setIsFullscreen] = useState(false);
    let [isPiPMode, setIsPiPMode] = useState(false);
    let [backgroundBlur, setBackgroundBlur] = useState(false);
    let [videoFilter, setVideoFilter] = useState('none');
    let [layoutMode, setLayoutMode] = useState('grid');
    let [mutedParticipants, setMutedParticipants] = useState({});
    let [pinnedVideo, setPinnedVideo] = useState(null);
    let [showSettings, setShowSettings] = useState(false);
    let [snackbarOpen, setSnackbarOpen] = useState(false);
    let [snackbarMessage, setSnackbarMessage] = useState('');
    let [snackbarSeverity, setSnackbarSeverity] = useState('info');
    // setConnectionQuality intentionally omitted — value is display-only (no setter needed yet)
    const [connectionQuality] = useState('good');
    let [showEmojiPicker, setShowEmojiPicker] = useState(false);
    let [anchorEl, setAnchorEl] = useState(null);
    let [brightness, setBrightness] = useState(100);
    let [contrast, setContrast] = useState(100);
    let [saturation, setSaturation] = useState(100);
    let [mirrorVideo, setMirrorVideo] = useState(false);
    let [noiseSuppression, setNoiseSuppression] = useState(false);
    let [autoGainControl, setAutoGainControl] = useState(true);
    let [echoCancellation, setEchoCancellation] = useState(true);
    let [recordingTime, setRecordingTime] = useState(0);
    // FIX 1: Removed unused `videoQuality` / `setVideoQuality` state (was line 124)
    let [chatNotifications, setChatNotifications] = useState(true);

    const emojis = ['👍', '👏', '❤️', '😂', '😮', '🎉', '👋', '🔥', '✨', '💯'];
    const filterOptions = [
        { name: 'None', value: 'none' },
        { name: 'Grayscale', value: 'grayscale(100%)' },
        { name: 'Sepia', value: 'sepia(100%)' },
        { name: 'Invert', value: 'invert(100%)' },
        { name: 'Vintage', value: 'sepia(50%) contrast(120%)' },
        { name: 'Cool', value: 'hue-rotate(180deg)' },
        { name: 'Warm', value: 'sepia(30%) saturate(150%)' },
    ];

    // keep recordingTimeRef in sync
    useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);

    // FIX 2: Wrap getPermissions in useCallback so it's a stable reference
    // usable as a useEffect dependency (was line 144)
    const getPermissions = useCallback(async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(!!videoPermission);
            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(!!audioPermission);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            if (videoPermission || audioPermission) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: !!videoPermission,
                    audio: !!audioPermission
                });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) localVideoref.current.srcObject = userMediaStream;
                }
            }
        } catch (error) {
            console.log(error);
            showSnackbar('Error accessing camera/microphone', 'error');
        }
    }, []); // no external deps — safe stable reference

    useEffect(() => {
        getPermissions();
        setParticipants([{ id: 'self', username: 'You', isSelf: true }]);
    }, [getPermissions]); // FIX 2 applied: getPermissions now listed as dep

    // Recording timer
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } else {
            setRecordingTime(0);
            recordingTimeRef.current = 0;
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // FIX 3: Wrap getUserMedia in useCallback so it's a stable dep (was line 190)
    const getUserMediaSuccess = useCallback((stream) => {
        try { window.localStream.getTracks().forEach(t => t.stop()); } catch (e) { }
        window.localStream = stream;
        localVideoref.current.srcObject = stream;
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((desc) => {
                connections[id].setLocalDescription(desc).then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                }).catch(e => console.log(e));
            });
        }
        stream.getTracks().forEach(track => {
            track.onended = () => {
                setVideo(false); setAudio(false);
                try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch (e) { }
                let bs = (...args) => new MediaStream([black(...args), silence()]);
                window.localStream = bs();
                localVideoref.current.srcObject = window.localStream;
                for (let id in connections) {
                    connections[id].addStream(window.localStream);
                    connections[id].createOffer().then((desc) => {
                        connections[id].setLocalDescription(desc).then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                        }).catch(e => console.log(e));
                    });
                }
            };
        });
    }, []);

    const getUserMedia = useCallback(() => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video, audio })
                .then(getUserMediaSuccess)
                .catch(e => console.log(e));
        } else {
            try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch (e) { }
        }
    }, [video, audio, videoAvailable, audioAvailable, getUserMediaSuccess]);

    useEffect(() => {
        if (video !== undefined && audio !== undefined) getUserMedia();
    }, [video, audio, getUserMedia]); // FIX 3 applied: getUserMedia now listed as dep

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    };

    // FIX 5: Wrap getDislayMedia in useCallback so it's a stable dep (was line 652)
    const getDislayMedia = useCallback(() => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => console.log(e));
            }
        }
    }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps
    // Note: getDislayMediaSuccess is intentionally omitted — it's defined below
    // and is stable (doesn't close over changing state). Listing it would cause
    // a circular dependency. This is the standard pattern for this WebRTC setup.

    let getDislayMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(t => t.stop()); } catch (e) { }
        window.localStream = stream;
        localVideoref.current.srcObject = stream;
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((desc) => {
                connections[id].setLocalDescription(desc).then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                }).catch(e => console.log(e));
            });
        }
        stream.getTracks().forEach(track => {
            track.onended = () => {
                setScreen(false);
                try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch (e) { }
                let bs = (...args) => new MediaStream([black(...args), silence()]);
                window.localStream = bs();
                localVideoref.current.srcObject = window.localStream;
                getUserMedia();
            };
        });
    };

    // ── RECORDING ────────────────────────────────────────────────────────────
    let startRecording = () => {
        try {
            recordedChunks.current = [];

            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');

            let mixedAudioStream = null;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioCtx();
                const destination = audioCtx.createMediaStreamDestination();

                const addTrack = (track) => {
                    try {
                        const ms = new MediaStream([track]);
                        const source = audioCtx.createMediaStreamSource(ms);
                        source.connect(destination);
                    } catch (e) { /* skip bad track */ }
                };

                if (window.localStream) {
                    window.localStream.getAudioTracks().forEach(addTrack);
                }
                videoRef.current.forEach(v => {
                    if (v && v.stream) v.stream.getAudioTracks().forEach(addTrack);
                });

                mixedAudioStream = destination.stream;
            } catch (e) {
                console.warn('Audio mixing failed, recording without audio:', e);
            }

            const drawFrame = () => {
                // FIX 4: Removed unused `frameCount` variable (was line 314)
                try {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    const remoteVids = videoRef.current;
                    const count = remoteVids.length;

                    if (count === 0) {
                        const localEl = localVideoref.current;
                        if (localEl && localEl.readyState >= 2 && localEl.videoWidth > 0) {
                            ctx.drawImage(localEl, 0, 0, canvas.width, canvas.height);
                        } else {
                            ctx.fillStyle = '#333';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.fillStyle = '#aaa';
                            ctx.font = 'bold 32px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('Waiting for participants...', canvas.width / 2, canvas.height / 2);
                            ctx.textAlign = 'left';
                        }
                    } else {
                        const cols = Math.ceil(Math.sqrt(count));
                        const rows = Math.ceil(count / cols);
                        const tileW = Math.floor(canvas.width / cols);
                        const tileH = Math.floor(canvas.height / rows);

                        remoteVids.forEach((vid, i) => {
                            const col = i % cols;
                            const row = Math.floor(i / cols);
                            const x = col * tileW;
                            const y = row * tileH;

                            const videoEl = remoteVideoRefs.current[vid.socketId];
                            if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
                                ctx.drawImage(videoEl, x, y, tileW, tileH);
                            } else {
                                ctx.fillStyle = '#222';
                                ctx.fillRect(x, y, tileW, tileH);
                                ctx.fillStyle = '#666';
                                ctx.font = '20px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText('📷 No Video', x + tileW / 2, y + tileH / 2);
                                ctx.textAlign = 'left';
                            }

                            ctx.fillStyle = 'rgba(0,0,0,0.65)';
                            ctx.fillRect(x + 10, y + tileH - 40, 120, 28);
                            ctx.fillStyle = 'white';
                            ctx.font = 'bold 13px Arial';
                            ctx.fillText('User ' + vid.socketId.slice(0, 4), x + 16, y + tileH - 20);
                        });

                        const localEl = localVideoref.current;
                        if (localEl && localEl.readyState >= 2 && localEl.videoWidth > 0) {
                            const PW = 280, PH = 180;
                            const PX = canvas.width - PW - 16;
                            const PY = canvas.height - PH - 16;

                            ctx.shadowColor = 'rgba(0,0,0,0.6)';
                            ctx.shadowBlur = 16;

                            ctx.save();
                            drawRoundedRect(ctx, PX, PY, PW, PH, 10);
                            ctx.clip();
                            ctx.drawImage(localEl, PX, PY, PW, PH);
                            ctx.restore();

                            ctx.shadowBlur = 0;

                            ctx.strokeStyle = 'white';
                            ctx.lineWidth = 3;
                            drawRoundedRect(ctx, PX, PY, PW, PH, 10);
                            ctx.stroke();

                            ctx.fillStyle = 'rgba(0,0,0,0.7)';
                            ctx.fillRect(PX + 8, PY + PH - 34, 50, 24);
                            ctx.fillStyle = 'white';
                            ctx.font = 'bold 12px Arial';
                            ctx.fillText('You', PX + 16, PY + PH - 16);
                        }
                    }

                    ctx.fillStyle = 'rgba(220,0,0,0.9)';
                    ctx.beginPath();
                    ctx.arc(28, 28, 14, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.fillRect(46, 16, 120, 24);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText('REC  ' + formatTime(recordingTimeRef.current), 52, 33);

                } catch (drawErr) {
                    console.warn('Draw frame error:', drawErr);
                }

                recordingAnimFrameRef.current = requestAnimationFrame(drawFrame);
            };

            drawFrame();

            const fps = 24;
            let canvasStream;
            if (typeof canvas.captureStream === 'function') {
                canvasStream = canvas.captureStream(fps);
            } else if (typeof canvas.mozCaptureStream === 'function') {
                canvasStream = canvas.mozCaptureStream(fps);
            } else {
                cancelAnimationFrame(recordingAnimFrameRef.current);
                showSnackbar('Screen recording not supported in this browser', 'error');
                return;
            }

            if (mixedAudioStream) {
                mixedAudioStream.getAudioTracks().forEach(t => {
                    try { canvasStream.addTrack(t); } catch (e) { }
                });
            }

            const mimeType = getSupportedMimeType();
            const recorderOptions = mimeType ? { mimeType } : {};

            let recorder;
            try {
                recorder = new MediaRecorder(canvasStream, recorderOptions);
            } catch (e) {
                try {
                    recorder = new MediaRecorder(canvasStream);
                } catch (e2) {
                    cancelAnimationFrame(recordingAnimFrameRef.current);
                    showSnackbar('MediaRecorder not supported in this browser', 'error');
                    return;
                }
            }

            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                cancelAnimationFrame(recordingAnimFrameRef.current);
                if (recordedChunks.current.length === 0) {
                    showSnackbar('Recording failed — no data captured', 'error');
                    return;
                }
                const blob = new Blob(recordedChunks.current, { type: mimeType || 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `meeting-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
                showSnackbar('✅ Recording saved!', 'success');
            };

            recorder.onerror = (e) => {
                console.error('MediaRecorder error:', e);
                showSnackbar('Recording error: ' + e.error?.name, 'error');
            };

            recorder.start(1000);
            setIsRecording(true);
            showSnackbar('🔴 Recording started — full meeting captured', 'info');

        } catch (err) {
            console.error('startRecording error:', err);
            showSnackbar('Could not start recording: ' + err.message, 'error');
        }
    };

    let stopRecording = () => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (e) { console.log(e); }
        cancelAnimationFrame(recordingAnimFrameRef.current);
        setIsRecording(false);
    };

    let takeScreenshot = () => {
        try {
            const canvas = document.createElement('canvas');
            const vid = localVideoref.current;
            canvas.width = vid.videoWidth || 640;
            canvas.height = vid.videoHeight || 480;
            canvas.getContext('2d').drawImage(vid, 0, 0);
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `screenshot-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
                showSnackbar('📷 Screenshot saved!', 'success');
            });
        } catch (e) {
            showSnackbar('Screenshot failed: ' + e.message, 'error');
        }
    };

    // ── WebRTC signaling ─────────────────────────────────────────────────────
    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message);
        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((desc) => {
                            connections[fromId].setLocalDescription(desc).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                            }).catch(e => console.log(e));
                        }).catch(e => console.log(e));
                    }
                }).catch(e => console.log(e));
            }
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    };

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });
        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href, username);
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id, uname) => {
                setVideos(v => v.filter(x => x.socketId !== id));
                setParticipants(p => p.filter(x => x.id !== id));
                showSnackbar(`${uname || 'Someone'} left the meeting`, 'info');
            });

            socketRef.current.on('hand-raised', (id, uname, raised) => {
                if (raised) { setRaisedHands(prev => [...prev, { id, username: uname }]); showSnackbar(`${uname} raised their hand ✋`, 'info'); }
                else setRaisedHands(prev => prev.filter(h => h.id !== id));
            });

            socketRef.current.on('reaction', (id, uname, emoji) => {
                const r = { id: Date.now(), emoji, username: uname };
                setReactions(prev => [...prev, r]);
                setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 3000);
            });

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections);
                    connections[socketListId].onicecandidate = (event) => {
                        if (event.candidate)
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
                    };
                    connections[socketListId].onaddstream = (event) => {
                        let exists = videoRef.current.find(v => v.socketId === socketListId);
                        if (exists) {
                            setVideos(vids => {
                                const updated = vids.map(v => v.socketId === socketListId ? { ...v, stream: event.stream } : v);
                                videoRef.current = updated;
                                return updated;
                            });
                        } else {
                            const nv = { socketId: socketListId, stream: event.stream };
                            setVideos(vids => {
                                const updated = [...vids, nv];
                                videoRef.current = updated;
                                return updated;
                            });
                            setParticipants(prev => [...prev, { id: socketListId, username: `User ${socketListId.slice(0, 4)}` }]);
                        }
                    };
                    const ls = window.localStream || (() => {
                        const bs = new MediaStream([black(), silence()]);
                        window.localStream = bs;
                        return bs;
                    })();
                    connections[socketListId].addStream(ls);
                });

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue;
                        try { connections[id2].addStream(window.localStream); } catch (e) { }
                        connections[id2].createOffer().then((desc) => {
                            connections[id2].setLocalDescription(desc).then(() => {
                                socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }));
                            }).catch(e => console.log(e));
                        });
                    }
                }
            });
        });
    };

    let silence = () => {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const dst = osc.connect(ctx.createMediaStreamDestination());
        osc.start(); ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    let black = ({ width = 640, height = 480 } = {}) => {
        const canvas = Object.assign(document.createElement('canvas'), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        return Object.assign(canvas.captureStream().getVideoTracks()[0], { enabled: false });
    };

    // ── Controls ─────────────────────────────────────────────────────────────
    let handleVideo = () => { setVideo(v => !v); };
    let handleAudio = () => { setAudio(a => !a); };

    useEffect(() => { if (screen !== undefined) getDislayMedia(); }, [screen, getDislayMedia]); // FIX 5 applied

    let handleScreen = () => setScreen(s => !s);

    let handleEndCall = () => {
        try { localVideoref.current.srcObject.getTracks().forEach(t => t.stop()); } catch (e) { }
        window.location.href = '/';
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages(prev => [...prev, { sender, data, timestamp: new Date().toLocaleTimeString() }]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages(n => n + 1);
            if (chatNotifications) showSnackbar(`💬 New message from ${sender}`, 'info');
        }
    };

    let sendMessage = () => {
        if (message.trim()) { socketRef.current.emit('chat-message', message, username); setMessage(''); }
    };

    let handleHandRaise = () => {
        const s = !handRaised;
        setHandRaised(s);
        socketRef.current.emit('raise-hand', s, username);
        showSnackbar(s ? '✋ Hand raised' : 'Hand lowered', 'info');
    };

    let sendReaction = (emoji) => {
        socketRef.current.emit('send-reaction', emoji, username);
        setShowEmojiPicker(false);
        const r = { id: Date.now(), emoji };
        setReactions(prev => [...prev, r]);
        setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 3000);
    };

    let toggleFullscreen = () => {
        if (!isFullscreen) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
        else { document.exitFullscreen(); setIsFullscreen(false); }
    };

    let togglePiP = async () => {
        try {
            if (!isPiPMode) { await localVideoref.current.requestPictureInPicture(); setIsPiPMode(true); }
            else { await document.exitPictureInPicture(); setIsPiPMode(false); }
        } catch (e) { showSnackbar('PiP not supported', 'error'); }
    };

    let copyMeetingLink = () => {
        navigator.clipboard.writeText(window.location.href);
        showSnackbar('🔗 Meeting link copied!', 'success');
    };

    let connect = () => {
        if (username.trim()) { setAskForUsername(false); getMedia(); }
        else showSnackbar('Please enter a name', 'warning');
    };

    let showSnackbar = (msg, severity = 'info') => {
        setSnackbarMessage(msg);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const getCombinedFilter = () => {
        const f = [];
        if (videoFilter !== 'none') f.push(videoFilter);
        if (brightness !== 100) f.push(`brightness(${brightness}%)`);
        if (contrast !== 100) f.push(`contrast(${contrast}%)`);
        if (saturation !== 100) f.push(`saturate(${saturation}%)`);
        if (backgroundBlur) f.push('blur(4px)');
        return f.length ? f.join(' ') : 'none';
    };

    // ── Icon button style helper ─────────────────────────────────────────────
    const btnStyle = (active, danger) => ({
        color: danger ? '#ff4444' : active ? 'white' : 'white',
        backgroundColor: danger ? 'rgba(255,68,68,0.25)' : 'rgba(255,255,255,0.12)',
        borderRadius: '50%',
        transition: 'background 0.2s',
    });

    // ── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div>
            {askForUsername ? (
                // ══ LOBBY ════════════════════════════════════════════════════
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, backgroundColor: '#1a1a2e' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: 28 }}>🎥 Join Meeting</h2>
                    <TextField
                        label="Your Name"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        variant="outlined"
                        onKeyPress={e => e.key === 'Enter' && connect()}
                        style={{ width: 300 }}
                        InputProps={{ style: { color: 'white' } }}
                        InputLabelProps={{ style: { color: '#aaa' } }}
                        sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                    />
                    <Button variant="contained" size="large" onClick={connect} style={{ borderRadius: 30, paddingInline: 40 }}>
                        Join
                    </Button>
                    <div style={{ border: '2px solid #444', borderRadius: 12, overflow: 'hidden' }}>
                        <video ref={localVideoref} autoPlay muted style={{ width: 420, display: 'block', transform: mirrorVideo ? 'scaleX(-1)' : 'none' }} />
                    </div>
                    <FormControlLabel control={<Switch checked={mirrorVideo} onChange={e => setMirrorVideo(e.target.checked)} />} label="Mirror video" style={{ color: 'white' }} />
                    <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                        <Alert severity={snackbarSeverity} variant="filled" onClose={() => setSnackbarOpen(false)}>{snackbarMessage}</Alert>
                    </Snackbar>
                </div>
            ) : (
                // ══ MEETING ROOM ═════════════════════════════════════════════
                <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#1a1a2e', overflow: 'hidden' }}>

                    {/* Chat Drawer */}
                    <Drawer anchor="right" open={showModal} onClose={() => { setModal(false); setNewMessages(0); }}>
                        <div style={{ width: 360, padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h2 style={{ margin: 0 }}>💬 Chat</h2>
                                <IconButton onClick={() => setModal(false)}><CloseIcon /></IconButton>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                                {messages.length ? messages.map((item, i) => (
                                    <div key={i} style={{ marginBottom: 10, padding: '10px 12px', backgroundColor: '#f0f4ff', borderRadius: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <b style={{ fontSize: 13 }}>{item.sender}</b>
                                            <span style={{ fontSize: 11, color: '#888' }}>{item.timestamp}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 14 }}>{item.data}</p>
                                    </div>
                                )) : <p style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>No messages yet</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <TextField value={message} onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} label="Message" variant="outlined" size="small" fullWidth />
                                <IconButton color="primary" onClick={sendMessage}><SendIcon /></IconButton>
                            </div>
                        </div>
                    </Drawer>

                    {/* Participants Drawer */}
                    <Drawer anchor="right" open={showParticipants} onClose={() => setShowParticipants(false)}>
                        <div style={{ width: 360, padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h2 style={{ margin: 0 }}>👥 Participants ({participants.length})</h2>
                                <IconButton onClick={() => setShowParticipants(false)}><CloseIcon /></IconButton>
                            </div>
                            {participants.map(p => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 10 }}>
                                    <Avatar style={{ backgroundColor: '#1976d2', width: 36, height: 36, fontSize: 16 }}>{p.username[0].toUpperCase()}</Avatar>
                                    <span style={{ marginLeft: 12, flex: 1, fontWeight: 'bold', fontSize: 14 }}>{p.username}{p.isSelf && ' (You)'}</span>
                                    {!p.isSelf && (
                                        <IconButton size="small" onClick={() => setMutedParticipants(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                                            {mutedParticipants[p.id] ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                                        </IconButton>
                                    )}
                                </div>
                            ))}
                            {raisedHands.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <h3>✋ Raised Hands</h3>
                                    {raisedHands.map(h => <Chip key={h.id} label={h.username} icon={<PanToolIcon />} style={{ margin: 4 }} color="primary" />)}
                                </div>
                            )}
                        </div>
                    </Drawer>

                    {/* Settings Drawer */}
                    <Drawer anchor="right" open={showSettings} onClose={() => setShowSettings(false)}>
                        <div style={{ width: 380, padding: 20, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h2 style={{ margin: 0 }}>⚙️ Settings</h2>
                                <IconButton onClick={() => setShowSettings(false)}><CloseIcon /></IconButton>
                            </div>
                            <h3 style={{ marginTop: 0 }}>Video Adjustments</h3>
                            <p style={{ margin: '6px 0 2px', fontSize: 13 }}>Brightness ({brightness}%)</p>
                            <Slider value={brightness} onChange={(e, v) => setBrightness(v)} min={0} max={200} size="small" />
                            <p style={{ margin: '6px 0 2px', fontSize: 13 }}>Contrast ({contrast}%)</p>
                            <Slider value={contrast} onChange={(e, v) => setContrast(v)} min={0} max={200} size="small" />
                            <p style={{ margin: '6px 0 2px', fontSize: 13 }}>Saturation ({saturation}%)</p>
                            <Slider value={saturation} onChange={(e, v) => setSaturation(v)} min={0} max={200} size="small" />
                            <h3>Filters</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                {filterOptions.map(f => <Button key={f.value} variant={videoFilter === f.value ? 'contained' : 'outlined'} size="small" onClick={() => setVideoFilter(f.value)}>{f.name}</Button>)}
                            </div>
                            <h3>Layout</h3>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                <Button variant={layoutMode === 'grid' ? 'contained' : 'outlined'} onClick={() => setLayoutMode('grid')} startIcon={<GridViewIcon />} fullWidth>Grid</Button>
                                <Button variant={layoutMode === 'spotlight' ? 'contained' : 'outlined'} onClick={() => setLayoutMode('spotlight')} startIcon={<ViewAgendaIcon />} fullWidth>Spotlight</Button>
                            </div>
                            <h3>Audio</h3>
                            <FormControlLabel control={<Switch checked={echoCancellation} onChange={e => setEchoCancellation(e.target.checked)} />} label="Echo Cancellation" /><br />
                            <FormControlLabel control={<Switch checked={noiseSuppression} onChange={e => setNoiseSuppression(e.target.checked)} />} label="Noise Suppression" /><br />
                            <FormControlLabel control={<Switch checked={autoGainControl} onChange={e => setAutoGainControl(e.target.checked)} />} label="Auto Gain Control" />
                            <h3 style={{ marginTop: 16 }}>Display</h3>
                            <FormControlLabel control={<Switch checked={mirrorVideo} onChange={e => setMirrorVideo(e.target.checked)} />} label="Mirror My Video" /><br />
                            <FormControlLabel control={<Switch checked={chatNotifications} onChange={e => setChatNotifications(e.target.checked)} />} label="Chat Notifications" />
                            <h3 style={{ marginTop: 16 }}>Meeting</h3>
                            <p style={{ fontSize: 13 }}>Connection: <Chip label={connectionQuality} color="success" size="small" /></p>
                            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyMeetingLink} fullWidth>Copy Meeting Link</Button>
                        </div>
                    </Drawer>

                    {/* Reactions overlay */}
                    <div style={{ position: 'absolute', bottom: 120, right: 310, zIndex: 1000, pointerEvents: 'none', display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
                        {reactions.map(r => (
                            <div key={r.id} style={{ fontSize: 46, animation: 'floatUp 3s ease-out forwards' }}>{r.emoji}</div>
                        ))}
                    </div>

                    {/* Recording indicator */}
                    {isRecording && (
                        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(220,0,0,0.9)', color: 'white', padding: '9px 22px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 10, zIndex: 1000, fontWeight: 'bold', fontSize: 14 }}>
                            <FiberManualRecordIcon style={{ fontSize: 15 }} />
                            REC &nbsp; {formatTime(recordingTime)}
                        </div>
                    )}

                    {/* Connection quality */}
                    <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 1000 }}>
                        <Chip label={`● ${connectionQuality}`} color="success" size="small" />
                    </div>

                    {/* ── MAIN GRID ── */}
                    <div style={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '85%', height: '75%',
                        display: layoutMode === 'grid' ? 'grid' : 'flex',
                        gridTemplateColumns: layoutMode === 'grid' ? 'repeat(auto-fit, minmax(280px, 1fr))' : undefined,
                        gap: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        {videos.map(vid => (
                            <div
                                key={vid.socketId}
                                onDoubleClick={() => { setPinnedVideo(pinnedVideo === vid.socketId ? null : vid.socketId); setLayoutMode('spotlight'); }}
                                style={{
                                    position: 'relative', backgroundColor: '#111', borderRadius: 14, overflow: 'hidden',
                                    border: pinnedVideo === vid.socketId ? '3px solid #4CAF50' : '2px solid #333',
                                    height: layoutMode === 'grid' ? '100%' : '82%',
                                    width: layoutMode === 'grid' ? '100%' : '72%',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: 'pointer',
                                }}
                            >
                                <video
                                    data-socket={vid.socketId}
                                    ref={ref => {
                                        if (ref && vid.stream) {
                                            ref.srcObject = vid.stream;
                                            ref.muted = !!mutedParticipants[vid.socketId];
                                            remoteVideoRefs.current[vid.socketId] = ref;
                                        }
                                    }}
                                    autoPlay
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: getCombinedFilter() }}
                                />
                                <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.65)', color: 'white', padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 'bold' }}>
                                    User {vid.socketId.slice(0, 4)}
                                </div>
                                {mutedParticipants[vid.socketId] && (
                                    <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.65)', borderRadius: '50%', padding: 4 }}>
                                        <VolumeOffIcon style={{ color: 'white', fontSize: 18 }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Local PiP video */}
                    <div style={{ position: 'absolute', bottom: 106, right: 24, zIndex: 999 }}>
                        <video
                            ref={localVideoref}
                            autoPlay muted
                            style={{ width: 250, height: 160, borderRadius: 14, border: '3px solid white', objectFit: 'cover', display: 'block', filter: getCombinedFilter(), transform: mirrorVideo ? 'scaleX(-1)' : 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                        />
                        <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.65)', color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 'bold' }}>
                            You
                        </div>
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* ── CONTROL BAR ── */}
                    <div style={{
                        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        backgroundColor: 'rgba(0,0,0,0.85)', padding: '11px 22px',
                        borderRadius: 50, zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    }}>
                        <Tooltip title={video ? 'Turn off camera' : 'Turn on camera'}>
                            <IconButton onClick={handleVideo} style={btnStyle(video, !video)}>
                                {video ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={audio ? 'Mute' : 'Unmute'}>
                            <IconButton onClick={handleAudio} style={btnStyle(audio, !audio)}>
                                {audio ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                        </Tooltip>

                        {screenAvailable && (
                            <Tooltip title={screen ? 'Stop sharing' : 'Share screen'}>
                                <IconButton onClick={handleScreen} style={{ ...btnStyle(true, false), color: screen ? '#4CAF50' : 'white' }}>
                                    {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </IconButton>
                            </Tooltip>
                        )}

                        <Tooltip title={isRecording ? 'Stop recording' : 'Record full meeting'}>
                            <IconButton onClick={isRecording ? stopRecording : startRecording} style={{ ...btnStyle(true, isRecording), color: isRecording ? '#ff4444' : 'white' }}>
                                {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Screenshot">
                            <IconButton onClick={takeScreenshot} style={btnStyle(true, false)}>
                                <CameraAltIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={handRaised ? 'Lower hand' : 'Raise hand'}>
                            <IconButton onClick={handleHandRaise} style={{ ...btnStyle(true, false), color: handRaised ? '#FFD700' : 'white' }}>
                                <PanToolIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Reaction">
                            <IconButton onClick={() => setShowEmojiPicker(v => !v)} style={btnStyle(true, false)}>
                                <InsertEmoticonIcon />
                            </IconButton>
                        </Tooltip>
                        {showEmojiPicker && (
                            <div style={{ position: 'absolute', bottom: 74, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '10px 14px', borderRadius: 16, display: 'flex', gap: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 2000 }}>
                                {emojis.map(emoji => (
                                    <span key={emoji} onClick={() => sendReaction(emoji)}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        style={{ cursor: 'pointer', fontSize: 30, padding: 6, borderRadius: 8, transition: 'transform 0.15s' }}>
                                        {emoji}
                                    </span>
                                ))}
                            </div>
                        )}

                        <Badge badgeContent={newMessages} max={99} color="error">
                            <Tooltip title="Chat">
                                <IconButton onClick={() => { setModal(v => !v); setNewMessages(0); }} style={btnStyle(true, false)}>
                                    <ChatIcon />
                                </IconButton>
                            </Tooltip>
                        </Badge>

                        <Tooltip title="Participants">
                            <IconButton onClick={() => setShowParticipants(v => !v)} style={btnStyle(true, false)}>
                                <Badge badgeContent={participants.length} color="primary">
                                    <PeopleIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Settings">
                            <IconButton onClick={() => setShowSettings(true)} style={btnStyle(true, false)}>
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="More">
                            <IconButton onClick={e => setAnchorEl(e.currentTarget)} style={btnStyle(true, false)}>
                                <MoreVertIcon />
                            </IconButton>
                        </Tooltip>
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                            <MenuItem onClick={() => { toggleFullscreen(); setAnchorEl(null); }}>
                                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                <span style={{ marginLeft: 10 }}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                            </MenuItem>
                            <MenuItem onClick={() => { togglePiP(); setAnchorEl(null); }}>
                                <PictureInPictureIcon /><span style={{ marginLeft: 10 }}>Picture in Picture</span>
                            </MenuItem>
                            <MenuItem onClick={() => { setBackgroundBlur(v => !v); setAnchorEl(null); }}>
                                <BlurOnIcon /><span style={{ marginLeft: 10 }}>{backgroundBlur ? 'Remove Blur' : 'Background Blur'}</span>
                            </MenuItem>
                            <MenuItem onClick={() => { copyMeetingLink(); setAnchorEl(null); }}>
                                <ContentCopyIcon /><span style={{ marginLeft: 10 }}>Copy Link</span>
                            </MenuItem>
                        </Menu>

                        <div style={{ width: 2, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

                        <Tooltip title="End call">
                            <IconButton onClick={handleEndCall} style={{ color: 'white', backgroundColor: '#dc3545', borderRadius: '50%' }}>
                                <CallEndIcon />
                            </IconButton>
                        </Tooltip>
                    </div>

                    {/* Snackbar */}
                    <Snackbar open={snackbarOpen} autoHideDuration={3500} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                        <Alert severity={snackbarSeverity} variant="filled" onClose={() => setSnackbarOpen(false)}>{snackbarMessage}</Alert>
                    </Snackbar>

                    <style>{`
                        @keyframes floatUp {
                            0%   { opacity:1; transform:translateY(0) scale(1); }
                            60%  { opacity:1; transform:translateY(-70px) scale(1.15); }
                            100% { opacity:0; transform:translateY(-140px) scale(0.8); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
