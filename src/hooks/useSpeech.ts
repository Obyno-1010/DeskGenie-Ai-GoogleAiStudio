import { useState, useCallback, useRef } from 'react';

export function useSpeech() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback((lang: string = 'en-US') => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = lang;
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onend = () => setIsRecording(false);
    
    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentTranscript += event.results[i][0].transcript;
        }
      }
      if (currentTranscript) setTranscript(prev => prev + ' ' + currentTranscript);
    };

    recognitionRef.current.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const speak = useCallback((text: string, language: string = 'en-US') => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { isRecording, transcript, setTranscript, startRecording, stopRecording, speak };
}
