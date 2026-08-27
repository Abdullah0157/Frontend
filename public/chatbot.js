(function() {
    // ==========================================
    // CONFIGURATION
    // ==========================================
    const CONFIG = {
        bot_name: "JobStream AI",
        primary_color: "#1e1b4b", // Dark Indigo (matches site header)
        bg_color: "#ffffff",
        text_color: "#1e293b",
        bubble_bg: "#1e1b4b",
        bubble_icon_color: "#ffffff"
    };

    // ==========================================
    // STYLES
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        #ag-chat-bubble {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            background: ${CONFIG.bubble_bg};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
            z-index: 9999;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        #ag-chat-bubble:hover {
            transform: scale(1.1) rotate(5deg);
        }
        #ag-chat-bubble svg {
            width: 30px;
            height: 30px;
            fill: ${CONFIG.bubble_icon_color};
        }
        #ag-chat-window {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 380px;
            height: 550px;
            background: #0f172a;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 9999;
            font-family: 'Inter', sans-serif;
            border: 1px solid #1e293b;
            transition: all 0.3s ease;
        }
        #ag-chat-window.open {
            display: flex;
            animation: slideUp 0.4s ease;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #ag-chat-header {
            background: ${CONFIG.primary_color};
            padding: 24px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        #ag-chat-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        #ag-chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #0f172a;
        }
        .ag-msg {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
            color: #f1f5f9;
        }
        .ag-msg-bot {
            background: #1e293b;
            border: 1px solid #334155;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .ag-msg-user {
            background: #4f46e5;
            color: #ffffff;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        #ag-chat-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: linear-gradient(90deg, #ffffff, #818cf8, #ffffff);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer {
            to { background-position: -200% center; }
        }
        .dot-typing {
            position: relative;
            left: -9999px;
            width: 6px;
            height: 6px;
            border-radius: 3px;
            background-color: #94a3b8;
            color: #94a3b8;
            box-shadow: 9984px 0 0 0 #94a3b8, 9999px 0 0 0 #94a3b8, 10014px 0 0 0 #94a3b8;
            animation: dotTyping 1.5s infinite linear;
        }
        #ag-chat-input-area {
            padding: 16px;
            background: #0f172a;
            border-top: 1px solid #1e293b;
            display: flex;
            gap: 8px;
        }
        #ag-chat-input {
            flex: 1;
            background: #1e293b;
            border: 1px solid transparent;
            padding: 12px 16px;
            border-radius: 12px;
            outline: none;
            font-size: 14px;
            color: #cbd5e1;
        }
        #ag-chat-input::placeholder { color: #475569; }
        #ag-chat-input:focus {
            border-color: #334155;
        }
        #ag-chat-send {
            background: #1e1b4b;
            border: none;
            color: white;
            padding: 0 16px;
            border-radius: 12px;
            cursor: pointer;
            font-weight: bold;
        }
        .ag-typing {
            margin: 10px 20px;
            display: none;
            gap: 4px;
            align-items: center;
        }
        .dot {
            width: 8px;
            height: 8px;
            background: #818cf8;
            border-radius: 50%;
            opacity: 0.5;
            animation: pulse 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        .ag-job-list {
            margin: 12px 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .ag-job-card {
            background: #1e293b;
            border: 1px solid rgba(16, 185, 129, 0.2);
            padding: 8px 16px;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: 40px;
            transition: all 0.2s;
            cursor: pointer;
            text-decoration: none !important;
            margin: 0 !important;
            white-space: nowrap;
        }
        .ag-job-card:hover {
            border-color: #10b981;
            background: #232f3e;
        }
        .ag-job-info {
            font-size: 13px;
            font-weight: 500;
            color: #f1f5f9;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
        }
        .ag-job-salary {
            font-size: 13px;
            font-weight: 700;
            color: #10b981;
            flex-shrink: 0;
        }
        .ag-more-btn {
            display: block;
            text-align: left;
            margin-top: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #10b981;
            text-decoration: none;
            padding-left: 2px;
            transition: all 0.2s;
        }
        .ag-more-btn:hover {
            text-decoration: underline;
            opacity: 0.8;
        }
        .highlight-green {
            color: #10b981;
            font-weight: 700;
        }
        @keyframes pulse {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 480px) {
            #ag-chat-window {
                width: calc(100% - 48px);
                height: 60vh;
            }
        }
    `;
    document.head.appendChild(style);

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const bubble = document.createElement('div');
    bubble.id = 'ag-chat-bubble';
    bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

    const chatWindow = document.createElement('div');
    chatWindow.id = 'ag-chat-window';
    chatWindow.innerHTML = `
        <div id="ag-chat-header">
            <div>
                <h3>${CONFIG.bot_name}</h3>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                    <span style="color: #22c55e; font-size: 14px;">●</span> Available 24/7
                </div>
            </div>
            <span style="cursor:pointer; font-size: 20px;" onclick="document.getElementById('ag-chat-window').classList.remove('open')">✕</span>
        </div>
        <div id="ag-chat-messages">
            <div class="ag-msg ag-msg-bot">Hello! I'm your JobStream AI assistant. How can I help you find your dream job today?</div>
        </div>
        <div id="ag-typing" class="ag-typing" style="display: none;"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <div id="ag-chat-input-area">
            <label style="cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0 10px;">
                <svg style="width: 20px; height: 20px; fill: #64748b;" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v10.5c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5V5c0-2.76-2.24-5-5-5s-5 2.24-5 5v12.5c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-1.5z"/></svg>
                <input type="file" id="ag-resume-upload" style="display: none;" accept=".pdf">
            </label>
            <input type="text" id="ag-chat-input" placeholder="Type your message...">
            <button id="ag-chat-send">Send</button>
        </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(chatWindow);

    // ==========================================
    // LOGIC
    // ==========================================
    const input = document.getElementById('ag-chat-input');
    const sendBtn = document.getElementById('ag-chat-send');
    const messages = document.getElementById('ag-chat-messages');
    const typing = document.getElementById('ag-typing');
    
    // Memory Buffer
    let chatHistory = [];

    const resumeUpload = document.getElementById('ag-resume-upload');

    bubble.onclick = () => chatWindow.classList.toggle('open');

    // Is there a signed-in session? /api/profile is same-origin and cookie-based,
    // so it answers this without exposing anything: 200 = signed in, 401 = not.
    async function isSignedIn() {
        try {
            const r = await fetch('/api/profile', { cache: 'no-store' });
            return r.ok;
        } catch { return false; }
    }

    resumeUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';                       // allow re-picking the same file

        if (!/\.pdf$/i.test(file.name)) {
            appendMessage("I can only read PDF resumes at the moment. Please upload a PDF and I'll take a look.", 'bot');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            appendMessage("That file is over 5MB. Please upload a smaller PDF.", 'bot');
            return;
        }

        // Gate on sign-in FIRST. Uploading anonymously used to silently go
        // nowhere: the resume couldn't be attached to a profile, so nothing the
        // candidate did next remembered it.
        if (!(await isSignedIn())) {
            appendMessage("Uploading resume…", 'user');
            appendMessage(
                "Before I can read your resume, you'll need to sign in — that's how I attach it to your profile so your matches and interviews stay with you.\n\n" +
                "[LOGIN_LINK]\n\nOnce you're signed in, come back and upload it here and I'll get straight to work.",
                'bot'
            );
            return;
        }

        appendMessage("Uploading resume for AI matching...", 'user');
        typing.style.display = 'flex';

        try {
            // 1. Save it to the candidate's own profile (our app, not the match
            //    service) so the resume actually persists for interviews.
            const fd = new FormData();
            fd.append('file', file);
            const up = await fetch('/api/upload-resume', { method: 'POST', body: fd });
            if (!up.ok) throw new Error('upload failed');
            const { text, pages, chars } = await up.json();
            await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_text: text, resume_filename: file.name, resume_pages: pages, resume_chars: chars }),
            });
            fetch('/api/parse-resume', { method: 'POST' }).catch(() => {}); // background

            // 2. Ask the match service for roles.
            const formData = new FormData();
            formData.append('file', file);
            let matches = [];
            try {
                const response = await fetch(`https://abd217391-jobstream-backend.hf.space/api/match-resume`, {
                    method: 'POST', body: formData,
                });
                const data = await response.json();
                // Tolerate either a bare array or a wrapped object.
                matches = Array.isArray(data) ? data : (data?.jobs || data?.matches || []);
            } catch { matches = []; }

            sessionStorage.setItem('matchedJobs', JSON.stringify(matches));
            typing.style.display = 'none';

            // 3. No openings is a normal state, not an error — say so plainly.
            //    Previously an empty list was still handed to the model as "here
            //    are your matches:" followed by nothing, and it replied that the
            //    matches never arrived, which read as broken.
            if (!matches.length) {
                appendMessage(
                    "Your resume is saved to your profile — that part's done.\n\n" +
                    "I don't have any open roles to match you against right now, so there's nothing to show yet. " +
                    "As soon as roles are posted I'll be able to match you instantly.\n\n" +
                    "In the meantime you can take an AI interview to get your skills assessed, which makes your matches much stronger later.",
                    'bot'
                );
                return;
            }

            const top3 = matches.slice(0, 3);
            const jobSummary = top3
                .map(j => `[JOB: ${j.title || 'Role'} | ${j.company || 'Company'} | ${j.salary || 'Salary undisclosed'}]`)
                .join('\n');

            typing.style.display = 'flex';
            const aiResponse = await fetch(`https://abd217391-jobstream-backend.hf.space/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        ...chatHistory,
                        { role: "user", parts: [{ text: `I have just uploaded my resume and the system found these top matches for me:\n${jobSummary}\n\nPlease present these matches to me in a professional, elite way and mention that I can click "Explore All" or use the paperclip to refine my search.` }] }
                    ]
                })
            });
            typing.style.display = 'none';

            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const botText = aiData.text;
                appendMessage(botText, 'bot');
                chatHistory.push({ role: "model", parts: [{ text: botText }] });
            } else {
                appendMessage(`I've found your matches! Here are your top picks:\n\n${jobSummary}\n\n[MORE_JOBS]`, 'bot');
            }
        } catch (err) {
            console.error(err);
            typing.style.display = 'none';
            appendMessage("I couldn't read that resume. Please make sure it's a text-based PDF (not a scan) and try again.", 'bot');
        }
    };

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        input.value = '';
        // Show Typing
        typing.style.display = 'flex';
        messages.scrollTop = messages.scrollHeight;

        // Add user message to history
        chatHistory.push({ role: "user", parts: [{ text: text }] });

        try {
            const response = await fetch(`https://abd217391-jobstream-backend.hf.space/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: chatHistory
                })
            });

            if (response.ok) {
                const data = await response.json();
                const botText = data.text;
                
                // Add bot response to history
                chatHistory.push({ role: "model", parts: [{ text: botText }] });
                
                // Keep history lean (last 6 messages for reliability)
                if (chatHistory.length > 6) chatHistory = chatHistory.slice(-6);

                typing.style.display = 'none';
                appendMessage(botText, 'bot');
            } else {
                const errText = await response.text();
                console.error(`JobStream AI Error:`, errText);
                typing.style.display = 'none';
                appendMessage("I apologize, but I'm having trouble connecting right now. Please try again later.", 'bot');
            }
        } catch (e) {
            console.error(`JobStream AI Network error:`, e);
            typing.style.display = 'none';
            appendMessage("I apologize, but I'm having trouble connecting right now. Please try again later.", 'bot');
        }
    }

    function formatMessage(text) {
        // Remove messy triple asterisks
        text = text.replace(/\*\*\*/g, '');
        
        // 0. Handle Green Highlights: [GREEN: text]
        text = text.replace(/\[GREEN:\s*(.*?)\s*\]/g, '<span class="highlight-green">$1</span>');

        // 1. EXTRACT all job cards into an array BEFORE any other processing
        const jobs = [];
        text = text.replace(/\[JOB:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\]/g, (match, title, company, salary) => {
            jobs.push({ title, company, salary });
            return '%%JOBCARD%%';
        });

        // 2. EXTRACT [MORE_JOBS]
        const hasMore = text.includes('[MORE_JOBS]');
        text = text.replace(/\[MORE_JOBS\]/g, '');

        // 2b. EXTRACT [LOGIN_LINK] — shown when an upload is attempted while
        // signed out, so the candidate has a one-tap way to fix it.
        const hasLogin = text.includes('[LOGIN_LINK]');
        text = text.replace(/\[LOGIN_LINK\]/g, '');

        // 3. Build the complete job list HTML as ONE clean block
        let jobListHTML = '';
        if (jobs.length > 0) {
            const cards = jobs.map(j => 
                `<a href="/jobs" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;text-decoration:none;border:1px solid rgba(16,185,129,0.2);border-radius:10px;background:#1e293b;min-height:40px;cursor:pointer;"><div style="font-size:13px;font-weight:600;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%;">${j.title} — ${j.company}</div><div style="font-size:13px;font-weight:700;color:#10b981;white-space:nowrap;flex-shrink:0;">${j.salary}</div></a>`
            ).join('');
            jobListHTML = `<div style="display:flex;flex-direction:column;gap:4px;margin:10px 0;">${cards}</div>`;
            if (hasMore) {
                jobListHTML += `<a href="/jobs" style="display:block;color:#10b981;font-size:13px;font-weight:600;text-decoration:none;margin-top:6px;">Explore more for more jobs</a>`;
            }
        }

        // 4. Replace all %%JOBCARD%% placeholders with a single marker
        // (collapse multiple adjacent markers + any whitespace between them into one)
        text = text.replace(/(%%JOBCARD%%[\s\n]*)+/g, '%%JOBBLOCK%%');

        // 5. Standard Markdown to HTML conversion (safe — no job HTML to corrupt)
        let html = text
            .replace(/^### (.*$)/gim, '<h4 style="margin:15px 0 8px;font-weight:800;color:#000;text-transform:uppercase;font-size:13px;letter-spacing:0.5px;">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#000;">$1</strong>')
            .replace(/^\* (.*$)/gim, '<div style="margin-bottom:6px;padding-left:12px;border-left:2px solid #e2e8f0;color:#000;">$1</div>')
            .replace(/\n/g, '<br>');

        // 6. Swap in the clean job list block
        html = html.replace(/(<br>)*%%JOBBLOCK%%(<br>)*/g, jobListHTML);

        // 7. Append a real sign-in button when the message asked for one.
        if (hasLogin) {
            html += `<a href="/login?next=/dashboard/profile" style="display:inline-block;margin-top:10px;padding:9px 18px;border-radius:10px;background:#1e1b4b;color:#fff;font-size:13px;font-weight:700;text-decoration:none;">Sign in to continue</a>`;
        }

        return html;
    }

    function appendMessage(text, side) {
        const msg = document.createElement('div');
        msg.className = `ag-msg ag-msg-${side}`;
        
        if (side === 'bot') {
            msg.innerHTML = formatMessage(text);
        } else {
            msg.innerText = text;
        }
        
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

})();
