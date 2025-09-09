document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const views = {
        warning: document.getElementById('warningView'),
        invalidPage: document.getElementById('invalidPageView'),
        main: document.getElementById('mainView'),
    };
    const understandButton = document.getElementById('understandButton');
    const refreshButton = document.getElementById('refreshButton');
    const searchInput = document.getElementById('searchInput');
    const autocompleteResults = document.getElementById('autocompleteResults');
    const studentImage = document.getElementById('studentImage');
    const statusText = document.getElementById('statusText');
    const downloadImageBtn = document.getElementById('downloadImageBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');

    // --- State Variables ---
    let studentData = [];
    let currentStudent = null;

    // --- Main Initialization ---
    function initialize() {
        chrome.storage.local.get(['warningAccepted'], (result) => {
            if (!result.warningAccepted) {
                showView('warning');
            } else {
                checkPageValidity();
            }
        });
    }

    // --- View Management ---
    function showView(viewName) {
        Object.values(views).forEach(view => view.style.display = 'none');
        views[viewName].style.display = 'flex';
    }
    
    // --- Scraper Function ---
    function retrieveStoredData() {
        const storedDataString = sessionStorage.getItem('__project_spotlight_data');
        if (storedDataString) {
            return JSON.parse(storedDataString);
        }
        return null;
    }

    // --- Page & Data Handling ---
    function checkPageValidity() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url;
            if (url && url.includes('/secure/tla/mi.jsp') && url.includes('m=')) {
                showView('main');
                updateImageDisplay('loading');
                loadStudentData(tabs[0].id);
            } else {
                showView('invalidPage');
            }
        });
    }

    function loadStudentData(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: retrieveStoredData
        }, (injectionResults) => {
            if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                updateImageDisplay('error', 'Failed to communicate with page.');
                return;
            }
            const result = injectionResults[0].result;
            const attendees = result?.meetingInfo?.attendees;

            if (attendees) {
                const extractedStudents = [];
                for (const attendee of attendees) {
                    if (!attendee.name || !attendee.name.includes(' - ')) continue;
                    const nameParts = attendee.name.split(' - ');
                    extractedStudents.push({
                        rollNumber: nameParts[0].trim(),
                        name: nameParts[1].trim(),
                        attendanceType: attendee.attendanceType || 'N/A',
                        imageBase64: attendee.capturedFace?.$binary?.base64 || null
                    });
                }
                studentData = extractedStudents;
                downloadZipBtn.disabled = studentData.every(s => !s.imageBase64);
                updateImageDisplay('default');
            } else {
                updateImageDisplay('error', 'Data not found. Please refresh the page and try again.');
            }
        });
    }

    // --- UI Updates ---
    function updateImageDisplay(type, data) {
        studentImage.style.display = 'none';
        statusText.textContent = '';
        downloadImageBtn.disabled = true;

        switch (type) {
            case 'loading':
                statusText.textContent = 'Retrieving data...';
                break;
            case 'image':
                studentImage.src = `data:image/jpeg;base64,${data.imageBase64}`;
                studentImage.style.display = 'block';
                currentStudent = data;
                downloadImageBtn.disabled = false;
                break;
            case 'manual':
                statusText.textContent = 'Manual Attendance';
                currentStudent = data;
                break;
            case 'absent':
                statusText.textContent = 'Student is Absent';
                currentStudent = null;
                break;
            case 'error':
                 statusText.textContent = data;
                 currentStudent = null;
                 break;
            case 'default':
            default:
                studentImage.src = 'placeholder-icon.png';
                studentImage.style.display = 'block';
                currentStudent = null;
        }
    }

    // --- Search & Autocomplete ---
    function handleSearchInput() {
        const query = searchInput.value.toLowerCase();
        autocompleteResults.innerHTML = '';
        autocompleteResults.style.display = 'none';
        if (query.length < 2 || studentData.length === 0) return;
        const searchType = document.querySelector('input[name="searchType"]:checked').value;
        
        // THE FIX IS HERE: The .slice(0, 5) has been removed.
        const filteredData = studentData.filter(student => {
            const target = searchType === 'name' ? student.name.toLowerCase() : student.rollNumber.toLowerCase();
            return target.includes(query);
        });

        if (filteredData.length > 0) {
            autocompleteResults.style.display = 'block';
            filteredData.forEach(student => {
                const div = document.createElement('div');
                div.textContent = `${student.rollNumber} - ${student.name}`;
                div.addEventListener('mousedown', () => selectStudent(student));
                autocompleteResults.appendChild(div);
            });
        }
    }
    
    function selectStudent(student) {
        searchInput.value = `${student.rollNumber} - ${student.name}`;
        autocompleteResults.innerHTML = '';
        autocompleteResults.style.display = 'none';
        if (student.imageBase64) updateImageDisplay('image', student);
        else if (student.attendanceType === 'Manual') updateImageDisplay('manual', student);
        else updateImageDisplay('absent');
    }
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) autocompleteResults.style.display = 'none';
    });

    // --- Event Listeners ---
    understandButton.addEventListener('click', () => {
        chrome.storage.local.set({ warningAccepted: true }, checkPageValidity);
    });
    refreshButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.reload(tabs[0].id);
            window.close(); // Close the popup after initiating refresh
        });
    });
    searchInput.addEventListener('input', handleSearchInput);
    
    downloadImageBtn.addEventListener('click', () => {
        if (currentStudent && currentStudent.imageBase64) {
            const filename = `${currentStudent.rollNumber}_${currentStudent.name.replace(/\s+/g, '_')}.jpg`;
            chrome.runtime.sendMessage({ action: 'download', payload: { base64: currentStudent.imageBase64, filename: filename } });
        }
    });
    downloadZipBtn.addEventListener('click', () => {
        const zip = new JSZip();
        const imgFolder = zip.folder("student_images");
        studentData.forEach(student => {
            if (student.imageBase64) {
                const filename = `${student.rollNumber}_${student.name.replace(/\s+/g, '_')}.jpg`;
                imgFolder.file(filename, student.imageBase64, { base64: true });
            }
        });
        zip.generateAsync({ type: "base64" }).then(base64 => {
             chrome.runtime.sendMessage({ action: 'downloadZip', payload: { base64: base64, filename: 'CodeTantra_Attendance_Images.zip' } });
        });
    });

    initialize();
});