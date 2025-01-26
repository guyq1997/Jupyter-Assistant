export function initializeResizer() {
    const messagesPanel = document.getElementById('messages');
    const resizer = document.getElementById('messages-resizer');
    let isResizing = false;
    let lastDownX = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastDownX = e.clientX;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const delta = lastDownX - e.clientX;
        const newWidth = messagesPanel.offsetWidth + delta;
        const maxWidth = window.innerWidth - 400; // Leave at least 400px for notebook
        const minWidth = 200;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            messagesPanel.style.width = `${newWidth}px`;
            lastDownX = e.clientX;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.userSelect = '';
    });

    window.addEventListener('resize', () => {
        const currentWidth = messagesPanel.offsetWidth;
        const maxWidth = window.innerWidth - 400;
        
        if (currentWidth > maxWidth) {
            messagesPanel.style.width = `${maxWidth}px`;
        }
    });
}

export function initializeFileUpload(onUploadSuccess) {
    const fileUpload = document.getElementById('file-upload');
    const uploadBtn = document.getElementById('upload-btn');

    uploadBtn.addEventListener('click', () => {
        fileUpload.click();
    });

    fileUpload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                onUploadSuccess(data);
            } else {
                console.error('Upload failed');
            }
        } catch (error) {
            console.error('Upload failed:', error.message);
        } finally {
            uploadBtn.disabled = false;
            fileUpload.value = '';
        }
    });
}

export function downloadNotebook() {
    const currentNotebook = window.currentNotebook;
    if (!currentNotebook) {
        console.error('No notebook is currently loaded');
        return;
    }

    if (window.notebookFunctions?.saveNotebook) {
        window.notebookFunctions.saveNotebook();
    }

    const downloadUrl = `/download/${currentNotebook}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = currentNotebook;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
} 