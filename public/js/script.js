document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const generateBtn = document.getElementById('generateBtn');
    const queryInput = document.getElementById('query');
    const outputTypeSelect = document.getElementById('outputType');
    const numPagesInput = document.getElementById('numPages');
    const numPagesContainer = document.getElementById('pagesGroup');
    const grantTypeSelect = document.getElementById('grantType');
    const grantTypeContainer = document.getElementById('grantTypeGroup');
    const outputContent = document.getElementById('output-content');
    const loading = document.getElementById('loading');
    const outputActions = document.getElementById('outputActions');
    
    // Get edit elements
    const outputContentDiv = document.getElementById('output-content');
    const editContentDiv = document.getElementById('edit-content');
    const formFieldsContainer = document.querySelector('.form-fields');
    const saveEditsBtn = document.getElementById('save-edits');
    const cancelEditsBtn = document.getElementById('cancel-edits');
    
    // Get search elements
    const searchBtn = document.getElementById('searchBtn');
    const searchQuery = document.getElementById('searchQuery');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');
    const searchActions = document.getElementById('searchActions');
    const useSelectedBtn = document.getElementById('useSelectedBtn');
    
    // Get template modal elements
    const templateModal = document.getElementById('templateModal');
    const closeModal = document.querySelector('.close-modal');
    const copyButtons = document.querySelectorAll('.copy-btn');
    const exportTemplateBtn = document.getElementById('exportTemplate');
    const copyAllFieldsBtn = document.getElementById('copyAllFields');
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding tab pane
            const tabName = this.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
    
    // Toggle page number field based on selection
    outputTypeSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        
        // Hide page number input for grant proposals
        if (selectedValue === 'grant') {
            numPagesContainer.style.display = 'none';
            grantTypeContainer.classList.remove('hidden');
        } else {
            numPagesContainer.style.display = 'block';
            grantTypeContainer.classList.add('hidden');
        }
    });
    
    // Initialize page number visibility based on initial selection
    if (outputTypeSelect.value === 'grant') {
        numPagesContainer.style.display = 'none';
        grantTypeContainer.classList.remove('hidden');
    }
    
    // Handle template modal open/close
    function openTemplateModal() {
        templateModal.classList.remove('hidden');
    }
    
    function closeTemplateModal() {
        templateModal.classList.add('hidden');
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', closeTemplateModal);
    }
    
    // Close modal when clicking outside content
    window.addEventListener('click', function(event) {
        if (event.target === templateModal) {
            closeTemplateModal();
        }
    });

    // Store selected documents
    let selectedDocuments = [];

    // Handle document search
    searchBtn.addEventListener('click', async () => {
        const query = searchQuery.value;
        
        if (!query) {
            alert('Please enter a search query');
            return;
        }
        
        try {
            // Show loading indicator
            searchLoading.classList.remove('hidden');
            searchResults.innerHTML = '';
            searchActions.classList.add('hidden');
            selectedDocuments = [];
            
            // Call API to search documents
            const response = await fetch('/api/search-documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });
            
            if (!response.ok) {
                throw new Error('Failed to search documents');
            }
            
            const data = await response.json();
            
            // Display the search results
            if (data.documents && data.documents.length > 0) {
                const resultsHtml = `
                    <div class="documents-list">
                        ${data.documents.map((doc, index) => `
                            <div class="document-item">
                                <div class="document-checkbox">
                                    <input type="checkbox" id="doc-${index}" data-id="${doc.id}">
                                </div>
                                <div class="document-info">
                                    <h3>${doc.metadata.title}</h3>
                                    <p class="document-type">${doc.metadata.type}</p>
                                    <p class="document-content">${doc.metadata.content}</p>
                                    <div class="document-meta">
                                        <span class="document-relevance">Relevance: ${(doc.score * 100).toFixed(1)}%</span>
                                        ${doc.metadata.url ? `<a href="${doc.metadata.url}" target="_blank" class="document-link">View Source</a>` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                searchResults.innerHTML = resultsHtml;
                searchActions.classList.remove('hidden');
                
                // Add event listeners to checkboxes for document selection
                document.querySelectorAll('.document-item input[type="checkbox"]').forEach((checkbox, index) => {
                    checkbox.addEventListener('change', function() {
                        if (this.checked) {
                            selectedDocuments.push(data.documents[index]);
                        } else {
                            selectedDocuments = selectedDocuments.filter(doc => doc.id !== data.documents[index].id);
                        }
                    });
                });
            } else {
                searchResults.innerHTML = '<div class="no-results">No relevant documents found.</div>';
            }
        } catch (error) {
            console.error('Error:', error);
            searchResults.innerHTML = `<div class="error">Error searching documents: ${error.message}</div>`;
        } finally {
            // Hide loading indicator
            searchLoading.classList.add('hidden');
        }
    });
    
    // Handle using selected documents for generation
    useSelectedBtn.addEventListener('click', function() {
        if (selectedDocuments.length === 0) {
            alert('Please select at least one document');
            return;
        }
        
        // Switch to the generate tab
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === 'generate') {
                btn.click();
            }
        });
        
        // Set a notification to indicate documents are being used
        const notification = document.createElement('div');
        notification.className = 'selected-docs-notification';
        notification.innerHTML = `
            <i class="fas fa-file-alt"></i>
            Using ${selectedDocuments.length} selected document${selectedDocuments.length > 1 ? 's' : ''} as context
            <button class="clear-selection"><i class="fas fa-times"></i></button>
        `;
        document.querySelector('.card').appendChild(notification);
        
        // Add event listener to clear button
        notification.querySelector('.clear-selection').addEventListener('click', function() {
            notification.remove();
            selectedDocuments = [];
        });
    });

    // Handle form submission
    generateBtn.addEventListener('click', async () => {
        // Get form values
        const query = queryInput.value;
        const outputType = outputTypeSelect.value;
        const numPages = numPagesInput.value;
        const grantType = grantTypeSelect.value;

        // Validate form
        if (!query) {
            alert('Please enter a query for generation');
            return;
        }

        try {
            // Show loading indicator
            loading.classList.remove('hidden');
            outputContent.innerHTML = '';
            outputActions.innerHTML = '';
            
            // Determine which API endpoint to use based on whether documents are selected
            const endpoint = selectedDocuments.length > 0 ? '/api/generate-with-context' : '/api/generate';
            
            // Call API to generate document
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    outputType,
                    grantType: outputType === 'grant' ? grantType : null,
                    numPages: outputType === 'grant' ? 0 : numPages,
                    selectedDocumentIds: selectedDocuments.length > 0 
                        ? selectedDocuments.map(doc => doc.id) 
                        : undefined
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate document');
            }

            const data = await response.json();
            
            // Format and display the generated content
            formatOutput(data.content, data.outputType);
            
            // Add action buttons
            if (outputType === 'grant') {
                // Edit button
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Content';
                editBtn.addEventListener('click', function() {
                    editContent(grantType);
                });
                outputActions.appendChild(editBtn);
                
                // Download button
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'action-btn';
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download as DOCX';
                downloadBtn.addEventListener('click', function() {
                    downloadAsDocx(data.outputType, data.grantType || grantType);
                });
                outputActions.appendChild(downloadBtn);
                
                // Suggest Edits button
                const suggestEditsBtn = document.createElement('button');
                suggestEditsBtn.className = 'action-btn';
                suggestEditsBtn.innerHTML = '<i class="fas fa-magic"></i> Suggest Edits';
                suggestEditsBtn.addEventListener('click', function() {
                    suggestDocumentEdits(outputContent.innerHTML, data.outputType);
                });
                outputActions.appendChild(suggestEditsBtn);
            } else {
                // For other output types
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Content';
                editBtn.addEventListener('click', function() {
                    editContent();
                });
                outputActions.appendChild(editBtn);
                
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'action-btn';
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
                downloadBtn.addEventListener('click', function() {
                    downloadContent(data.outputType);
                });
                outputActions.appendChild(downloadBtn);
                
                // Suggest Edits button
                const suggestEditsBtn = document.createElement('button');
                suggestEditsBtn.className = 'action-btn';
                suggestEditsBtn.innerHTML = '<i class="fas fa-magic"></i> Suggest Edits';
                suggestEditsBtn.addEventListener('click', function() {
                    suggestDocumentEdits(outputContent.innerHTML, data.outputType);
                });
                outputActions.appendChild(suggestEditsBtn);
            }
            
            // Clear selected documents after generation
            const notification = document.querySelector('.selected-docs-notification');
            if (notification) {
                notification.remove();
            }
            selectedDocuments = [];
        } catch (error) {
            console.error('Error:', error);
            outputContent.innerHTML = `<div class="error">Error generating document: ${error.message}</div>`;
        } finally {
            // Hide loading indicator
            loading.classList.add('hidden');
        }
    });
    
    // Function to edit content
    function editContent(grantType) {
        // Get the HTML content from the output div
        const htmlContent = outputContentDiv.innerHTML;
        
        // Clear previous form fields
        formFieldsContainer.innerHTML = '';
        
        // Show the editor and hide the display
        outputContentDiv.classList.add('hidden');
        editContentDiv.classList.remove('hidden');
        
        // Add AI Edit button to the form
        const aiEditContainer = document.createElement('div');
        aiEditContainer.className = 'ai-edit-container';
        aiEditContainer.innerHTML = `
            <h3>AI-Powered Editing</h3>
            <div class="form-field">
                <label for="aiEditQuery">What changes would you like to make?</label>
                <textarea id="aiEditQuery" placeholder="Describe the changes you want to make to the document..."></textarea>
            </div>
            <button id="applyAiEdit" class="action-btn">Apply AI Edit</button>
            <div id="aiEditStatus" class="hidden">
                <div class="spinner"></div>
                <span>Applying AI edits...</span>
            </div>
        `;
        formFieldsContainer.appendChild(aiEditContainer);
        
        // Ensure the AI edit status is hidden initially
        setTimeout(() => {
            const aiEditStatus = document.getElementById('aiEditStatus');
            if (aiEditStatus) {
                aiEditStatus.classList.add('hidden');
                aiEditStatus.style.display = 'none';
            }
        }, 100);
        
        // Set up AI Edit button
        document.getElementById('applyAiEdit').addEventListener('click', function() {
            const query = document.getElementById('aiEditQuery').value;
            if (!query) {
                alert('Please describe the changes you want to make.');
                return;
            }
            
            // Show loading indicator
            const aiEditStatus = document.getElementById('aiEditStatus');
            aiEditStatus.classList.remove('hidden');
            aiEditStatus.style.display = 'flex';
            
            // Get the current form values
            const formData = collectFormData();
            
            // Apply AI edits
            applyAiEdits(query, formData, grantType);
        });
        
        // Create form fields based on document type
        if (grantType === 'rfp') {
            createRfpFormFields(htmlContent);
        } else if (grantType === 'generic') {
            createGenericFormFields(htmlContent);
        } else if (grantType === 'nonprofit') {
            createNonprofitFormFields(htmlContent);
        } else if (grantType === 'research') {
            createResearchFormFields(htmlContent);
        } else {
            // Default form for other document types
            createDefaultFormFields(htmlContent);
        }
    }
    
    // Function to collect all form data
    function collectFormData() {
        const fields = formFieldsContainer.querySelectorAll('.form-field input, .form-field textarea');
        const formData = {};
        
        // Exclude the AI edit query field
        fields.forEach(field => {
            if (field.id !== 'aiEditQuery') {
                formData[field.id] = field.value;
            }
        });
        
        return formData;
    }
    
    // Function to apply AI edits to the document
    async function applyAiEdits(query, formData, grantType) {
        try {
            // Generate the current HTML
            const currentHtml = generateHtmlFromFormData(formData, 'grant', grantType);
            
            // Call the AI API to get edited HTML
            const response = await fetch('/api/ai-edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    currentHtml,
                    grantType
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to apply AI edits');
            }
            
            const data = await response.json();
            
            // Extract content from the AI-edited HTML
            const editedContent = extractContentFromHtml(data.editedHtml);
            
            // Update form fields with the edited content
            updateFormWithContent(editedContent, grantType);
            
            // Hide loading indicator
            const aiEditStatus = document.getElementById('aiEditStatus');
            aiEditStatus.classList.add('hidden');
            aiEditStatus.style.display = 'none';
            
            // Clear the query field after successful edit
            document.getElementById('aiEditQuery').value = '';
            
            // Show success message
            alert('AI edits applied successfully!');
        } catch (error) {
            console.error('Error applying AI edits:', error);
            
            // Hide loading indicator
            const aiEditStatus = document.getElementById('aiEditStatus');
            aiEditStatus.classList.add('hidden');
            aiEditStatus.style.display = 'none';
            
            // Show error message
            alert(`Error applying AI edits: ${error.message}`);
        }
    }
    
    // Function to update form fields with content
    function updateFormWithContent(content, grantType) {
        // Update common fields
        if (content.title) {
            const titleField = document.getElementById('title');
            if (titleField) titleField.value = content.title;
        }
        
        // Update RFP specific fields
        if (grantType === 'rfp') {
            const fieldMappings = {
                postingDate: 'postingDate',
                solicitor: 'solicitor',
                address: 'address',
                purpose: 'purpose',
                background: 'background',
                applicationPeriod: 'applicationPeriod',
                priorToSubmissions: 'priorToSubmissions',
                afterSubmissions: 'afterSubmissions',
                underwritingPeriod: 'underwritingPeriod',
                underwritingReview: 'underwritingReview',
                revisionsReport: 'revisionsReport',
                submissionProcess: 'submissionProcess',
                inquiries: 'inquiries'
            };
            
            // Update timeline fields
            if (content.timeline) {
                if (content.timeline.applicationPeriod) {
                    const field = document.getElementById('timeline_applicationPeriod');
                    if (field) field.value = content.timeline.applicationPeriod;
                }
                if (content.timeline.priorSubmissions) {
                    const field = document.getElementById('timeline_priorSubmissions');
                    if (field) field.value = content.timeline.priorSubmissions;
                }
                if (content.timeline.afterSubmissions) {
                    const field = document.getElementById('timeline_afterSubmissions');
                    if (field) field.value = content.timeline.afterSubmissions;
                }
                if (content.timeline.underwritingPeriod) {
                    const field = document.getElementById('timeline_underwritingPeriod');
                    if (field) field.value = content.timeline.underwritingPeriod;
                }
                if (content.timeline.underwritingReview) {
                    const field = document.getElementById('timeline_underwritingReview');
                    if (field) field.value = content.timeline.underwritingReview;
                }
                if (content.timeline.revisionsReport) {
                    const field = document.getElementById('timeline_revisionsReport');
                    if (field) field.value = content.timeline.revisionsReport;
                }
            }
            
            // Update main content fields
            Object.entries(fieldMappings).forEach(([contentKey, fieldId]) => {
                if (content[contentKey]) {
                    const field = document.getElementById(fieldId);
                    if (field) field.value = content[contentKey];
                }
            });
        }
        // Add handling for other grant types as needed
        else if (grantType === 'generic' || grantType === 'nonprofit' || grantType === 'research') {
            // Similar field mappings for other grant types
            // ...
        }
    }
    
    // Function to create form fields for RFP grant type
    function createRfpFormFields(htmlContent) {
        // Extract content from HTML
        const content = extractContentFromHtml(htmlContent);
        console.log(content);
        
        // Create title field
        addFormField('title', 'Grant RFP Title', content.title || '', 'text');
        
        // Create header fields
        addFormSection('Header Information');
        addFormField('postingDate', 'Posting Date', content.postingDate || '', 'text');
        addFormField('solicitor', 'Solicited By', content.solicitor || '', 'text');
        addFormField('address', 'Address of Soliciting Party', content.address || '', 'text');
        
        // Create main sections
        addFormSection('Main Sections');
        addFormField('purpose', 'I. Purpose of Request for Proposal', content.purpose || '', 'textarea');
        addFormField('background', 'II. Organization Background', content.background || '', 'textarea');
        
        // Timeline section
        addFormSection('III. Timeline for Scope of Services');
        addFormField('timeline_applicationPeriod', 'A. Grant Application Period', content.timeline?.applicationPeriod || '', 'text');
        addFormField('timeline_priorSubmissions', 'B. Prior to Final Grant Submissions', content.timeline?.priorSubmissions || '', 'text');
        addFormField('timeline_afterSubmissions', 'C. After Final Grant Submissions', content.timeline?.afterSubmissions || '', 'text');
        addFormField('timeline_underwritingPeriod', 'D. Underwriting Period', content.timeline?.underwritingPeriod || '', 'text');
        addFormField('timeline_underwritingReview', 'E. Underwriting Review', content.timeline?.underwritingReview || '', 'text');
        addFormField('timeline_revisionsReport', 'F. Revisions and Final Report', content.timeline?.revisionsReport || '', 'text');
        
        // Scope of Services section
        addFormSection('IV. Scope of Services');
        addFormField('applicationPeriod', 'A. Grant Application Period', content.applicationPeriod || '', 'textarea');
        addFormField('priorToSubmissions', 'B. Prior to Final Grant Submissions', content.priorToSubmissions || '', 'textarea');
        addFormField('afterSubmissions', 'C. After Final Grant Submissions', content.afterSubmissions || '', 'textarea');
        addFormField('underwritingPeriod', 'D. Underwriting Period', content.underwritingPeriod || '', 'textarea');
        addFormField('underwritingReview', 'E. Underwriting Review', content.underwritingReview || '', 'textarea');
        addFormField('revisionsReport', 'F. Revisions and Final Report', content.revisionsReport || '', 'textarea');
        
        // Final sections
        addFormSection('Final Sections');
        addFormField('submissionProcess', 'V. Submission Process', content.submissionProcess || '', 'textarea');
        addFormField('inquiries', 'VI. Questions / Inquiries Information', content.inquiries || '', 'textarea');
    }
    
    // Function to create form fields for generic grant type
    function createGenericFormFields(htmlContent) {
        const content = extractContentFromHtml(htmlContent);
        
        // Add fields specific to generic grant proposals
        addFormField('title', 'Grant Proposal Title', content.title || '', 'text');
        addFormField('summary', 'Executive Summary', content.summary || '', 'textarea');
        addFormField('orgInfo', 'Organization Information', content.orgInfo || '', 'textarea');
        addFormField('need', 'Statement of Need', content.need || '', 'textarea');
        addFormField('projectDesc', 'Project Description', content.projectDesc || '', 'textarea');
        addFormField('goals', 'Goals and Objectives', content.goals || '', 'textarea');
        addFormField('timeline', 'Timeline', content.timeline || '', 'textarea');
        addFormField('budget', 'Budget', content.budget || '', 'textarea');
        addFormField('evaluation', 'Evaluation Plan', content.evaluation || '', 'textarea');
        addFormField('sustainability', 'Sustainability', content.sustainability || '', 'textarea');
        addFormField('conclusion', 'Conclusion', content.conclusion || '', 'textarea');
    }
    
    // Function to create form fields for nonprofit grant type
    function createNonprofitFormFields(htmlContent) {
        const content = extractContentFromHtml(htmlContent);
        
        // Add fields specific to nonprofit grant proposals
        addFormField('title', 'Non-profit Grant Proposal Title', content.title || '', 'text');
        addFormField('summary', 'Executive Summary', content.summary || '', 'textarea');
        addFormField('history', 'Organization History and Mission', content.history || '', 'textarea');
        addFormField('need', 'Community Need', content.need || '', 'textarea');
        addFormField('programDesc', 'Program Description', content.programDesc || '', 'textarea');
        addFormField('population', 'Target Population', content.population || '', 'textarea');
        addFormField('impact', 'Expected Impact', content.impact || '', 'textarea');
        addFormField('goals', 'Goals and Objectives', content.goals || '', 'textarea');
        addFormField('timeline', 'Timeline', content.timeline || '', 'textarea');
        addFormField('budget', 'Budget', content.budget || '', 'textarea');
        addFormField('metrics', 'Evaluation Metrics', content.metrics || '', 'textarea');
        addFormField('sustainability', 'Sustainability Plan', content.sustainability || '', 'textarea');
        addFormField('capacity', 'Organizational Capacity', content.capacity || '', 'textarea');
        addFormField('conclusion', 'Conclusion', content.conclusion || '', 'textarea');
    }
    
    // Function to create form fields for research grant type
    function createResearchFormFields(htmlContent) {
        const content = extractContentFromHtml(htmlContent);
        
        // Add fields specific to research grant proposals
        addFormField('title', 'Research Grant Proposal Title', content.title || '', 'text');
        addFormField('abstract', 'Abstract', content.abstract || '', 'textarea');
        addFormField('introduction', 'Introduction', content.introduction || '', 'textarea');
        addFormField('literature', 'Literature Review', content.literature || '', 'textarea');
        addFormField('questions', 'Research Question(s)', content.questions || '', 'textarea');
        addFormField('methodology', 'Methodology', content.methodology || '', 'textarea');
        addFormField('dataCollection', 'Data Collection and Analysis', content.dataCollection || '', 'textarea');
        addFormField('timeline', 'Timeline', content.timeline || '', 'textarea');
        addFormField('budget', 'Budget', content.budget || '', 'textarea');
        addFormField('outcomes', 'Expected Outcomes', content.outcomes || '', 'textarea');
        addFormField('significance', 'Significance and Impact', content.significance || '', 'textarea');
        addFormField('dissemination', 'Dissemination Plan', content.dissemination || '', 'textarea');
        addFormField('team', 'Research Team', content.team || '', 'textarea');
        addFormField('references', 'References', content.references || '', 'textarea');
    }
    
    // Function for other document types
    function createDefaultFormFields(htmlContent) {
        // Create a simple title + content form
        addFormField('title', 'Document Title', '', 'text');
        addFormField('content', 'Document Content', htmlToText(htmlContent), 'textarea');
    }
    
    // Helper function to extract content from HTML
    function extractContentFromHtml(html) {
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Utility function to decode HTML entities
        function decodeHtmlEntities(text) {
            const textArea = document.createElement('textarea');
            textArea.innerHTML = text;
            return textArea.value;
        }
        
        // Utility function to clean text (remove extra #, <br>, etc.)
        function cleanText(text) {
            return decodeHtmlEntities(text)
                .replace(/#/g, '')
                .replace(/\n+/g, ' ')
                .trim();
        }
        
        // Initialize content object
        const content = {};
        
        // Extract title - special case since it's the first h1
        const titleEl = tempDiv.querySelector('h1');
        if (titleEl) {
            content.title = titleEl.textContent.replace(/GRANT RFP:|GRANT PROPOSAL:|NON-PROFIT GRANT PROPOSAL:|RESEARCH GRANT PROPOSAL:/i, '').trim();
        }
        
        // Direct approach - get all h1 elements and extract content based on their text
        const h1Elements = tempDiv.querySelectorAll('h1');
        Array.from(h1Elements).forEach(h1 => {
            const headerText = h1.textContent.trim();
            
            // Skip the title which we already processed
            if (headerText.includes('GRANT RFP:') || 
                headerText.includes('GRANT PROPOSAL:') || 
                headerText.includes('NON-PROFIT GRANT PROPOSAL:') || 
                headerText.includes('RESEARCH GRANT PROPOSAL:')) {
                return;
            }
            
            // Match headers to content fields
            if (headerText === 'POSTING DATE') {
                // Get the text content after this header until the next header
                let node = h1.nextSibling;
                let text = '';
                while (node && node.nodeName !== 'H1') {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.postingDate = cleanText(text);
            }
            else if (headerText === 'SOLICITED BY') {
                let node = h1.nextSibling;
                let text = '';
                while (node && node.nodeName !== 'H1') {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.solicitor = cleanText(text);
            }
            else if (headerText === 'ADDRESS OF SOLICITING PARTY') {
                let node = h1.nextSibling;
                let text = '';
                while (node && node.nodeName !== 'H1') {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.address = cleanText(text);
            }
            else if (headerText === 'I. PURPOSE OF REQUEST FOR PROPOSAL') {
                let node = h1.nextSibling;
                let text = '';
                while (node && node.nodeName !== 'H1') {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.purpose = cleanText(text);
            }
            else if (headerText === 'II. ORGANIZATION BACKGROUND') {
                let node = h1.nextSibling;
                let text = '';
                while (node && node.nodeName !== 'H1') {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.background = cleanText(text);
            }
            else if (headerText === 'III. TIMELINE FOR SCOPE OF SERVICES') {
                // For timeline, we'll handle the table separately
            }
            else if (headerText === 'IV. SCOPE OF SERVICES') {
                // Scope of services is a container for subsections, we'll process them separately
            }
            else if (headerText === 'A. GRANT APPLICATION PERIOD') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('B. PRIOR')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.applicationPeriod = cleanText(text);
            }
            else if (headerText === 'B. PRIOR TO FINAL GRANT SUBMISSIONS') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('C. AFTER')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.priorToSubmissions = cleanText(text);
            }
            else if (headerText === 'C. AFTER FINAL GRANT SUBMISSIONS') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('D. UNDER')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.afterSubmissions = cleanText(text);
            }
            else if (headerText === 'D. UNDERWRITING PERIOD') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('E. UNDER')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.underwritingPeriod = cleanText(text);
            }
            else if (headerText === 'E. UNDERWRITING REVIEW') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('F. REVISIONS')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.underwritingReview = cleanText(text);
            }
            else if (headerText === 'F. REVISIONS AND FINAL REPORT') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('V. SUBMISSION')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.revisionsReport = cleanText(text);
            }
            else if (headerText === 'V. SUBMISSION PROCESS') {
                let node = h1.nextSibling;
                let text = '';
                while (node && (node.nodeName !== 'H1' || (node.nodeName === 'H1' && !node.textContent.includes('VI. QUESTIONS')))) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.submissionProcess = cleanText(text);
            }
            else if (headerText === 'VI. QUESTIONS / INQUIRIES INFORMATION') {
                let node = h1.nextSibling;
                let text = '';
                while (node) {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') {
                        text += node.textContent || ' ';
                    }
                    node = node.nextSibling;
                }
                content.inquiries = cleanText(text);
            }
        });
        
        // Extract timeline data from table
        const timelineTable = tempDiv.querySelector('table');
        if (timelineTable) {
            content.timeline = {};
            const rows = timelineTable.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const activity = cells[0].textContent.trim();
                    const date = cells[1].textContent.trim();
                    
                    if (activity.includes('Grant Application Period')) {
                        content.timeline.applicationPeriod = date;
                    } else if (activity.includes('Prior to Final')) {
                        content.timeline.priorSubmissions = date;
                    } else if (activity.includes('After Final')) {
                        content.timeline.afterSubmissions = date;
                    } else if (activity.includes('Underwriting Period')) {
                        content.timeline.underwritingPeriod = date;
                    } else if (activity.includes('Underwriting Review')) {
                        content.timeline.underwritingReview = date;
                    } else if (activity.includes('Revisions')) {
                        content.timeline.revisionsReport = date;
                    }
                }
            });
        }
        
        // Debug the content object by logging it to console
        console.log("Extracted content:", content);
        
        return content;
    }
    
    // Helper function to add a form field
    function addFormField(id, label, value, type = 'text') {
        const field = document.createElement('div');
        field.className = 'form-field';
        field.innerHTML = `
            <label for="${id}">${label}</label>
            ${type === 'textarea' 
                ? `<textarea id="${id}" name="${id}">${value}</textarea>` 
                : `<input type="${type}" id="${id}" name="${id}" value="${value}">`}
        `;
        formFieldsContainer.appendChild(field);
    }
    
    // Helper function to add a section header
    function addFormSection(title) {
        const section = document.createElement('div');
        section.className = 'form-section';
        section.innerHTML = `<h4>${title}</h4>`;
        formFieldsContainer.appendChild(section);
    }
    
    // Save edits button
    if (saveEditsBtn) {
        saveEditsBtn.addEventListener('click', function() {
            // Get all form fields
            const fields = formFieldsContainer.querySelectorAll('.form-field input, .form-field textarea');
            const formData = {};
            
            // Collect form data
            fields.forEach(field => {
                formData[field.id] = field.value;
            });
            
            // Generate HTML content from form data
            const htmlContent = generateHtmlFromFormData(formData, outputTypeSelect.value, grantTypeSelect.value);
            
            // Update output content
            outputContentDiv.innerHTML = htmlContent;
            
            // Hide editor and show content
            editContentDiv.classList.add('hidden');
            outputContentDiv.classList.remove('hidden');
        });
    }
    
    // Function to generate HTML from form data
    function generateHtmlFromFormData(formData, outputType, grantType) {
        // Utility function to escape HTML special characters
        function escapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        let html = '';
        
        if (outputType === 'grant') {
            if (grantType === 'rfp') {
                // Create RFP grant HTML with the same format as the original document
                html = `<div class="document-container grant-proposal">`;
                
                // Title
                if (formData.title) {
                    html += `<h1>GRANT RFP: ${escapeHtml(formData.title)}</h1><br><br>`;
                }
                
                // Header info
                if (formData.postingDate) {
                    html += `#<h1>POSTING DATE</h1><br>${escapeHtml(formData.postingDate)}<br><br>`;
                }
                
                if (formData.solicitor) {
                    html += `#<h1>SOLICITED BY</h1><br>${escapeHtml(formData.solicitor)}<br><br>`;
                }
                
                if (formData.address) {
                    html += `#<h1>ADDRESS OF SOLICITING PARTY</h1><br>${escapeHtml(formData.address)}<br><br>`;
                }
                
                // Purpose
                if (formData.purpose) {
                    html += `#<h1>I. PURPOSE OF REQUEST FOR PROPOSAL</h1><br><br>${escapeHtml(formData.purpose)}<br><br>`;
                }
                
                // Background
                if (formData.background) {
                    html += `#<h1>II. ORGANIZATION BACKGROUND</h1><br><br>${escapeHtml(formData.background)}<br><br>`;
                }
                
                // Timeline
                html += `#<h1>III. TIMELINE FOR SCOPE OF SERVICES</h1><br><br>`;
                
                // Create timeline table
                html += `<table class="content-table">
                    <thead>
                        <tr>
                            <th>ACTIVITY</th>
                            <th>PROJECTED DATE</th>
                        </tr>
                    </thead>
                    <tbody>`;
                
                // Add timeline rows
                if (formData.timeline_applicationPeriod) {
                    html += `<tr><td>A. Grant Application Period</td><td>${escapeHtml(formData.timeline_applicationPeriod)}</td></tr>`;
                }
                
                if (formData.timeline_priorSubmissions) {
                    html += `<tr><td>B. Prior to Final Grant Submissions</td><td>${escapeHtml(formData.timeline_priorSubmissions)}</td></tr>`;
                }
                
                if (formData.timeline_afterSubmissions) {
                    html += `<tr><td>C. After Final Grant Submissions</td><td>${escapeHtml(formData.timeline_afterSubmissions)}</td></tr>`;
                }
                
                if (formData.timeline_underwritingPeriod) {
                    html += `<tr><td>D. Underwriting Period</td><td>${escapeHtml(formData.timeline_underwritingPeriod)}</td></tr>`;
                }
                
                if (formData.timeline_underwritingReview) {
                    html += `<tr><td>E. Underwriting Review</td><td>${escapeHtml(formData.timeline_underwritingReview)}</td></tr>`;
                }
                
                if (formData.timeline_revisionsReport) {
                    html += `<tr><td>F. Revisions and Final Report</td><td>${escapeHtml(formData.timeline_revisionsReport)}</td></tr>`;
                }
                
                html += `</tbody></table><br>`;
                
                // Scope of Services
                html += `#<h1>IV. SCOPE OF SERVICES</h1><br><br>`;
                
                // Subsections
                if (formData.applicationPeriod) {
                    html += `##<h1>A. GRANT APPLICATION PERIOD</h1><br><br>${escapeHtml(formData.applicationPeriod)}<br><br>`;
                }
                
                if (formData.priorToSubmissions) {
                    html += `##<h1>B. PRIOR TO FINAL GRANT SUBMISSIONS</h1><br><br>${escapeHtml(formData.priorToSubmissions)}<br><br>`;
                }
                
                if (formData.afterSubmissions) {
                    html += `##<h1>C. AFTER FINAL GRANT SUBMISSIONS</h1><br><br>${escapeHtml(formData.afterSubmissions)}<br><br>`;
                }
                
                if (formData.underwritingPeriod) {
                    html += `##<h1>D. UNDERWRITING PERIOD</h1><br><br>${escapeHtml(formData.underwritingPeriod)}<br><br>`;
                }
                
                if (formData.underwritingReview) {
                    html += `##<h1>E. UNDERWRITING REVIEW</h1><br><br>${escapeHtml(formData.underwritingReview)}<br><br>`;
                }
                
                if (formData.revisionsReport) {
                    html += `##<h1>F. REVISIONS AND FINAL REPORT</h1><br><br>${escapeHtml(formData.revisionsReport)}<br><br>`;
                }
                
                // Final sections
                if (formData.submissionProcess) {
                    html += `#<h1>V. SUBMISSION PROCESS</h1><br><br>${escapeHtml(formData.submissionProcess)}<br><br>`;
                }
                
                if (formData.inquiries) {
                    html += `#<h1>VI. QUESTIONS / INQUIRIES INFORMATION</h1><br><br>${escapeHtml(formData.inquiries)}<br>`;
                }
                
                html += `</div>`;
            } else if (grantType === 'generic') {
                // Create generic grant proposal HTML
                html = `<div class="document-container grant-proposal">`;
                
                // Add generic grant proposal sections
                if (formData.title) {
                    html += `<h1>GRANT PROPOSAL: ${escapeHtml(formData.title)}</h1>`;
                }
                
                if (formData.summary) {
                    html += `<h2>EXECUTIVE SUMMARY</h2><p>${escapeHtml(formData.summary)}</p>`;
                }
                
                // Add remaining sections
                const sections = [
                    { id: 'orgInfo', title: 'ORGANIZATION INFORMATION' },
                    { id: 'need', title: 'STATEMENT OF NEED' },
                    { id: 'projectDesc', title: 'PROJECT DESCRIPTION' },
                    { id: 'goals', title: 'GOALS AND OBJECTIVES' },
                    { id: 'timeline', title: 'TIMELINE' },
                    { id: 'budget', title: 'BUDGET' },
                    { id: 'evaluation', title: 'EVALUATION PLAN' },
                    { id: 'sustainability', title: 'SUSTAINABILITY' },
                    { id: 'conclusion', title: 'CONCLUSION' }
                ];
                
                sections.forEach(section => {
                    if (formData[section.id]) {
                        html += `<h2>${section.title}</h2><p>${escapeHtml(formData[section.id])}</p>`;
                    }
                });
                
                html += `</div>`;
            } else if (grantType === 'nonprofit') {
                // Create nonprofit grant proposal HTML
                html = `<div class="document-container grant-proposal">`;
                
                // Add nonprofit grant proposal sections
                if (formData.title) {
                    html += `<h1>NON-PROFIT GRANT PROPOSAL: ${escapeHtml(formData.title)}</h1>`;
                }
                
                if (formData.summary) {
                    html += `<h2>EXECUTIVE SUMMARY</h2><p>${escapeHtml(formData.summary)}</p>`;
                }
                
                // Add remaining sections
                const sections = [
                    { id: 'history', title: 'ORGANIZATION HISTORY AND MISSION' },
                    { id: 'need', title: 'COMMUNITY NEED' },
                    { id: 'programDesc', title: 'PROGRAM DESCRIPTION' },
                    { id: 'population', title: 'TARGET POPULATION' },
                    { id: 'impact', title: 'EXPECTED IMPACT' },
                    { id: 'goals', title: 'GOALS AND OBJECTIVES' },
                    { id: 'timeline', title: 'TIMELINE' },
                    { id: 'budget', title: 'BUDGET' },
                    { id: 'metrics', title: 'EVALUATION METRICS' },
                    { id: 'sustainability', title: 'SUSTAINABILITY PLAN' },
                    { id: 'capacity', title: 'ORGANIZATIONAL CAPACITY' },
                    { id: 'conclusion', title: 'CONCLUSION' }
                ];
                
                sections.forEach(section => {
                    if (formData[section.id]) {
                        html += `<h2>${section.title}</h2><p>${escapeHtml(formData[section.id])}</p>`;
                    }
                });
                
                html += `</div>`;
            } else if (grantType === 'research') {
                // Create research grant proposal HTML
                html = `<div class="document-container grant-proposal">`;
                
                // Add research grant proposal sections
                if (formData.title) {
                    html += `<h1>RESEARCH GRANT PROPOSAL: ${escapeHtml(formData.title)}</h1>`;
                }
                
                // Add remaining sections
                const sections = [
                    { id: 'abstract', title: 'ABSTRACT' },
                    { id: 'introduction', title: 'INTRODUCTION' },
                    { id: 'literature', title: 'LITERATURE REVIEW' },
                    { id: 'questions', title: 'RESEARCH QUESTION(S)' },
                    { id: 'methodology', title: 'METHODOLOGY' },
                    { id: 'dataCollection', title: 'DATA COLLECTION AND ANALYSIS' },
                    { id: 'timeline', title: 'TIMELINE' },
                    { id: 'budget', title: 'BUDGET' },
                    { id: 'outcomes', title: 'EXPECTED OUTCOMES' },
                    { id: 'significance', title: 'SIGNIFICANCE AND IMPACT' },
                    { id: 'dissemination', title: 'DISSEMINATION PLAN' },
                    { id: 'team', title: 'RESEARCH TEAM' },
                    { id: 'references', title: 'REFERENCES' }
                ];
                
                sections.forEach(section => {
                    if (formData[section.id]) {
                        html += `<h2>${section.title}</h2><p>${escapeHtml(formData[section.id])}</p>`;
                    }
                });
                
                html += `</div>`;
            }
        } else {
            // For other document types
            html = `<div class="document-container">`;
            
            if (formData.title) {
                html += `<h1>${escapeHtml(formData.title)}</h1>`;
            }
            
            if (formData.content) {
                const contentParagraphs = formData.content.split('\n\n');
                contentParagraphs.forEach(paragraph => {
                    if (paragraph.trim()) {
                        html += `<p>${escapeHtml(paragraph)}</p>`;
                    }
                });
            }
            
            html += `</div>`;
        }
        
        return html;
    }
    
    // Cancel edits button
    if (cancelEditsBtn) {
        cancelEditsBtn.addEventListener('click', function() {
            // Hide editor and show content
            editContentDiv.classList.add('hidden');
            outputContentDiv.classList.remove('hidden');
        });
    }
    
    // Function to download content as DOCX
    function downloadAsDocx(outputType, grantType) {
        // Get formatted content
        const formattedContent = outputContentDiv.innerHTML;
        
        // Create a title based on output type
        let title = '';
        if (outputType === 'grant') {
            switch(grantType) {
                case 'rfp':
                    title = 'Grant RFP';
                    break;
                case 'generic':
                    title = 'Grant Proposal';
                    break;
                case 'nonprofit':
                    title = 'Non-profit Grant Proposal';
                    break;
                case 'research':
                    title = 'Research Grant Proposal';
                    break;
                default:
                    title = 'Grant Document';
            }
        } else {
            title = 'Generated Document';
        }
        
        // Extract a better title if available
        const h1 = outputContentDiv.querySelector('h1');
        if (h1) {
            title = h1.textContent.trim();
        }
        
        // Create a simple Word document
        const { Document, Packer, Paragraph, HeadingLevel } = docx;
        
        // Convert HTML to paragraphs
        const paragraphs = convertHtmlToParagraphs(formattedContent);
        
        // Create the document
        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });
        
        // Generate and download
        Packer.toBlob(doc).then(blob => {
            const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
            saveAs(blob, filename);
        });
    }
    
    // Function to convert HTML to docx paragraphs
    function convertHtmlToParagraphs(html) {
        const { Paragraph, HeadingLevel, TextRun } = docx;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const paragraphs = [];
        
        // Process each child node
        processNode(tempDiv, paragraphs);
        
        return paragraphs;
    }
    
    // Helper function to process nodes recursively
    function processNode(node, paragraphs) {
        const { Paragraph, HeadingLevel, TextRun } = docx;
        
        // Process child nodes
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                // Text node - add as paragraph if it has content
                const text = child.textContent.trim();
                if (text) {
                    paragraphs.push(new Paragraph({ text }));
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // Element node
                const tagName = child.tagName.toLowerCase();
                
                if (tagName === 'h1') {
                    paragraphs.push(new Paragraph({
                        text: child.textContent.trim(),
                        heading: HeadingLevel.HEADING_1
                    }));
                } else if (tagName === 'h2') {
                    paragraphs.push(new Paragraph({
                        text: child.textContent.trim(),
                        heading: HeadingLevel.HEADING_2
                    }));
                } else if (tagName === 'h3') {
                    paragraphs.push(new Paragraph({
                        text: child.textContent.trim(),
                        heading: HeadingLevel.HEADING_3
                    }));
                } else if (tagName === 'p') {
                    paragraphs.push(new Paragraph({
                        text: child.textContent.trim()
                    }));
                } else if (tagName === 'br') {
                    // Add an empty paragraph for breaks
                    paragraphs.push(new Paragraph({}));
                } else if (tagName === 'div' || tagName === 'span') {
                    // Process children recursively
                    processNode(child, paragraphs);
                }
                // For tables and other complex elements, we'd need more handling
                // But for this basic implementation, we'll just convert to text
                else {
                    // Process children recursively
                    processNode(child, paragraphs);
                }
            }
        });
    }
    
    // Function to download content (generic)
    function downloadContent(outputType) {
        // For simplicity, we'll just use the DOCX download for everything now
        downloadAsDocx(outputType);
    }

    // Function to extract sections from grant proposal content
    function extractGrantSections(content) {
        // Extract title
        const titleMatch = content.match(/GRANT RFP: (.*?)(?:<\/|$)/);
        if (titleMatch && titleMatch[1]) {
            document.getElementById('grantTitle').value = titleMatch[1].replace(/\[|\]/g, '').trim();
        }
        
        // Extract posting date, solicited by, and address
        const postingDateSection = content.match(/<h2>(?:.*?)POSTING DATE(?:.*?)<\/h2>([\s\S]*?)(?=<h2>|$)/i);
        if (postingDateSection && postingDateSection[1]) {
            const postingDate = postingDateSection[1].replace(/<[^>]*>/g, '').trim();
            document.getElementById('postingDate').value = postingDate;
        }
        
        const solicitedBySection = content.match(/<h2>(?:.*?)SOLICITED BY(?:.*?)<\/h2>([\s\S]*?)(?=<h2>|$)/i);
        if (solicitedBySection && solicitedBySection[1]) {
            const solicitedBy = solicitedBySection[1].replace(/<[^>]*>/g, '').trim();
            document.getElementById('solicitedBy').value = solicitedBy;
        }
        
        const addressSection = content.match(/<h2>(?:.*?)ADDRESS OF SOLICITING PARTY(?:.*?)<\/h2>([\s\S]*?)(?=<h2>|$)/i);
        if (addressSection && addressSection[1]) {
            const address = addressSection[1].replace(/<[^>]*>/g, '').trim();
            document.getElementById('solicitingAddress').value = address;
        }
        
        // Extract sections
        const sectionMap = {
            'purpose': 'I\\. PURPOSE OF REQUEST FOR PROPOSAL',
            'orgBackground': 'II\\. ORGANIZATION BACKGROUND',
            'timeline': 'III\\. TIMELINE FOR SCOPE OF SERVICES',
            'applicationPeriod': 'A\\. GRANT APPLICATION PERIOD',
            'priorToSubmissions': 'B\\. PRIOR TO FINAL GRANT SUBMISSIONS',
            'afterSubmissions': 'C\\. AFTER FINAL GRANT SUBMISSIONS',
            'underwritingPeriod': 'D\\. UNDERWRITING PERIOD',
            'underwritingReview': 'E\\. UNDERWRITING REVIEW',
            'revisionsReport': 'F\\. REVISIONS AND FINAL REPORT',
            'submissionProcess': 'V\\. SUBMISSION PROCESS',
            'inquiries': 'VI\\. QUESTIONS / INQUIRIES INFORMATION'
        };
        
        Object.entries(sectionMap).forEach(([elementId, sectionTitle]) => {
            let sectionRegex;
            if (sectionTitle.startsWith('I') || sectionTitle.startsWith('V')) {
                // Main sections (h2)
                sectionRegex = new RegExp(`<h2>(?:.*?)${sectionTitle}(?:.*?)</h2>([\\s\\S]*?)(?=<h2>|$)`, 'i');
            } else {
                // Subsections (h3)
                sectionRegex = new RegExp(`<h3>(?:.*?)${sectionTitle}(?:.*?)</h3>([\\s\\S]*?)(?=<h3>|<h2>|$)`, 'i');
            }
            
            const sectionMatch = content.match(sectionRegex);
            if (sectionMatch && sectionMatch[1]) {
                // Remove HTML tags
                const sectionText = sectionMatch[1].replace(/<[^>]*>/g, '').trim();
                
                // Find the element and set its value
                const element = document.getElementById(elementId);
                if (element) {
                    element.value = sectionText;
                }
            }
        });
        
        // Extract timeline table if it exists
        const tableMatch = content.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
        if (tableMatch && tableMatch[1] && tableMatch[0].includes('ACTIVITY') && tableMatch[0].includes('PROJECTED DATE')) {
            // Try to parse rows
            const tableRows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
            if (tableRows && tableRows.length > 1) { // Skip header row
                for (let i = 1; i < tableRows.length; i++) {
                    const cells = tableRows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                    if (cells && cells.length >= 2) {
                        const activity = cells[0].replace(/<[^>]*>/g, '').trim();
                        const date = cells[1].replace(/<[^>]*>/g, '').trim();
                        
                        // Map to timeline fields
                        if (activity.includes('Application Period')) {
                            const element = document.getElementById('timeline_applicationPeriod');
                            if (element) element.value = date;
                        } else if (activity.includes('Prior to Final')) {
                            const element = document.getElementById('timeline_priorSubmissions');
                            if (element) element.value = date;
                        } else if (activity.includes('After Final')) {
                            const element = document.getElementById('timeline_afterSubmissions');
                            if (element) element.value = date;
                        } else if (activity.includes('Underwriting Period')) {
                            const element = document.getElementById('timeline_underwritingPeriod');
                            if (element) element.value = date;
                        } else if (activity.includes('Underwriting Review')) {
                            const element = document.getElementById('timeline_underwritingReview');
                            if (element) element.value = date;
                        } else if (activity.includes('Revisions')) {
                            const element = document.getElementById('timeline_revisionsReport');
                            if (element) element.value = date;
                        }
                    }
                }
            }
        }
    }
    
    // Set up copy buttons for each template field
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            copyFromGeneratedContent(target, this);
        });
    });
    
    // Function to copy content from the generated output to a template field
    function copyFromGeneratedContent(target, button) {
        const grantContent = outputContentDiv;
        
        if (!grantContent) return;
        
        let content = '';
        
        // Extract the appropriate section based on the target
        if (target === 'title') {
            const titleElement = grantContent.querySelector('h1');
            if (titleElement) {
                content = titleElement.textContent.replace('GRANT RFP:', '').trim();
            }
        } else if (target === 'posting-date') {
            const postingDateHeader = Array.from(grantContent.querySelectorAll('h2'))
                .find(h2 => h2.textContent.includes('POSTING DATE'));
            if (postingDateHeader && postingDateHeader.nextElementSibling) {
                content = postingDateHeader.nextElementSibling.textContent.trim();
            }
        } else if (target === 'solicited-by') {
            const solicitedByHeader = Array.from(grantContent.querySelectorAll('h2'))
                .find(h2 => h2.textContent.includes('SOLICITED BY'));
            if (solicitedByHeader && solicitedByHeader.nextElementSibling) {
                content = solicitedByHeader.nextElementSibling.textContent.trim();
            }
        } else if (target === 'soliciting-address') {
            const addressHeader = Array.from(grantContent.querySelectorAll('h2'))
                .find(h2 => h2.textContent.includes('ADDRESS OF SOLICITING PARTY'));
            if (addressHeader && addressHeader.nextElementSibling) {
                content = addressHeader.nextElementSibling.textContent.trim();
            }
        } else {
            const sectionMap = {
                'purpose': 'I. PURPOSE OF REQUEST FOR PROPOSAL',
                'organization-background': 'II. ORGANIZATION BACKGROUND',
                'timeline': 'III. TIMELINE FOR SCOPE OF SERVICES',
                'application-period': 'A. GRANT APPLICATION PERIOD',
                'prior-submissions': 'B. PRIOR TO FINAL GRANT SUBMISSIONS',
                'after-submissions': 'C. AFTER FINAL GRANT SUBMISSIONS',
                'underwriting-period': 'D. UNDERWRITING PERIOD',
                'underwriting-review': 'E. UNDERWRITING REVIEW',
                'revisions-report': 'F. REVISIONS AND FINAL REPORT',
                'submission-process': 'V. SUBMISSION PROCESS',
                'inquiries': 'VI. QUESTIONS / INQUIRIES INFORMATION'
            };
            
            const sectionTitle = sectionMap[target];
            
            if (sectionTitle) {
                let sectionHeader;
                
                // Check if this is a subsection (A-F)
                if (sectionTitle.match(/^[A-F]\./)) {
                    sectionHeader = Array.from(grantContent.querySelectorAll('h3'))
                        .find(h3 => h3.textContent.includes(sectionTitle));
                } else {
                    sectionHeader = Array.from(grantContent.querySelectorAll('h2'))
                        .find(h2 => h2.textContent.includes(sectionTitle));
                }
                
                if (sectionHeader) {
                    let sectionContent = '';
                    let currentElement = sectionHeader.nextElementSibling;
                    
                    const stopTags = sectionTitle.match(/^[A-F]\./) ? ['H2', 'H3'] : ['H2'];
                    
                    while (currentElement && !stopTags.includes(currentElement.tagName)) {
                        if (currentElement.outerHTML) {
                            sectionContent += currentElement.outerHTML;
                        }
                        currentElement = currentElement.nextElementSibling;
                    }
                    
                    // Convert HTML to plain text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = sectionContent;
                    content = tempDiv.textContent.trim();
                }
            }
        }
        
        // Find corresponding input/textarea in template
        let targetElement;
        if (target === 'title') {
            targetElement = document.getElementById('grantTitle');
        } else if (target === 'posting-date') {
            targetElement = document.getElementById('postingDate');
        } else if (target === 'solicited-by') {
            targetElement = document.getElementById('solicitedBy');
        } else if (target === 'soliciting-address') {
            targetElement = document.getElementById('solicitingAddress');
        } else {
            const idMap = {
                'purpose': 'purpose',
                'organization-background': 'orgBackground',
                'timeline': 'timeline',
                'application-period': 'applicationPeriod',
                'prior-submissions': 'priorToSubmissions',
                'after-submissions': 'afterSubmissions',
                'underwriting-period': 'underwritingPeriod',
                'underwriting-review': 'underwritingReview',
                'revisions-report': 'revisionsReport',
                'submission-process': 'submissionProcess',
                'inquiries': 'inquiries'
            };
            
            const elementId = idMap[target];
            if (elementId) {
                targetElement = document.getElementById(elementId);
            }
        }
        
        if (targetElement && content) {
            targetElement.value = content;
            showCopySuccess(button);
        }
    }
    
    // Function to show copy success indicator
    function showCopySuccess(button) {
        button.classList.add('copy-success', 'show-success');
        setTimeout(() => {
            button.classList.remove('show-success');
        }, 2000);
    }
    
    // Handle export template button
    if (exportTemplateBtn) {
        exportTemplateBtn.addEventListener('click', function() {
            const templateData = {
                title: document.getElementById('grantTitle').value,
                postingDate: document.getElementById('postingDate').value,
                solicitedBy: document.getElementById('solicitedBy').value,
                solicitingAddress: document.getElementById('solicitingAddress').value,
                purpose: document.getElementById('purpose').value,
                orgBackground: document.getElementById('orgBackground').value,
                timeline: document.getElementById('timeline').value,
                applicationPeriod: document.getElementById('applicationPeriod').value,
                priorToSubmissions: document.getElementById('priorToSubmissions').value,
                afterSubmissions: document.getElementById('afterSubmissions').value,
                underwritingPeriod: document.getElementById('underwritingPeriod').value,
                underwritingReview: document.getElementById('underwritingReview').value,
                revisionsReport: document.getElementById('revisionsReport').value,
                submissionProcess: document.getElementById('submissionProcess').value,
                inquiries: document.getElementById('inquiries').value
            };
            
            // Create Word document
            createWordDocument(templateData);
        });
    }
    
    // Handle copy all fields button
    if (copyAllFieldsBtn) {
        copyAllFieldsBtn.addEventListener('click', function() {
            const targets = [
                'title', 'posting-date', 'solicited-by', 'soliciting-address',
                'purpose', 'organization-background', 'timeline',
                'application-period', 'prior-submissions', 'after-submissions',
                'underwriting-period', 'underwriting-review', 'revisions-report',
                'submission-process', 'inquiries'
            ];
            
            targets.forEach(target => {
                const button = document.querySelector(`.copy-btn[data-target="${target}"]`);
                if (button) {
                    copyFromGeneratedContent(target, button);
                }
            });
            
            // Show success message
            alert('All sections copied from generated content!');
        });
    }
    
    // Function to create and download a Word document
    function createWordDocument(data) {
        // Access docx library from the global scope
        const { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, HeadingLevel, BorderStyle } = docx;
        
        // Create a new document
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Title section
                    new Paragraph({
                        text: "GRANT RFP TEMPLATE",
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        thematicBreak: true
                    }),
                    
                    // Header Information Table
                    new Table({
                        width: {
                            size: 100,
                            type: "pct",
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [new Paragraph("POSTING DATE")],
                                        width: {
                                            size: 20,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph(data.postingDate)],
                                        width: {
                                            size: 30,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph("GRANT NAME")],
                                        width: {
                                            size: 20,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph(data.title)],
                                        width: {
                                            size: 30,
                                            type: "pct",
                                        }
                                    }),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [new Paragraph("SOLICITED BY")],
                                        width: {
                                            size: 20,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph(data.solicitedBy)],
                                        width: {
                                            size: 30,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph("ADDRESS OF SOLICITING PARTY")],
                                        width: {
                                            size: 20,
                                            type: "pct",
                                        }
                                    }),
                                    new TableCell({
                                        children: [new Paragraph(data.solicitingAddress)],
                                        width: {
                                            size: 30,
                                            type: "pct",
                                        }
                                    }),
                                ]
                            }),
                        ]
                    }),
                    
                    // Section I
                    new Paragraph({
                        text: "I. PURPOSE OF REQUEST FOR PROPOSAL",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    new Paragraph({
                        text: data.purpose
                    }),
                    
                    // Section II
                    new Paragraph({
                        text: "II. ORGANIZATION BACKGROUND",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    new Paragraph({
                        text: data.orgBackground
                    }),
                    
                    // Section III
                    new Paragraph({
                        text: "III. TIMELINE FOR SCOPE OF SERVICES",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    
                    // Add timeline content - try to parse table if it exists
                    ...parseTimelineContent(data.timeline),
                    
                    // Section IV
                    new Paragraph({
                        text: "IV. SCOPE OF SERVICES",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    
                    // Subsection A
                    new Paragraph({
                        text: "A. GRANT APPLICATION PERIOD",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.applicationPeriod
                    }),
                    
                    // Subsection B
                    new Paragraph({
                        text: "B. PRIOR TO FINAL GRANT SUBMISSIONS",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.priorToSubmissions
                    }),
                    
                    // Subsection C
                    new Paragraph({
                        text: "C. AFTER FINAL GRANT SUBMISSIONS",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.afterSubmissions
                    }),
                    
                    // Subsection D
                    new Paragraph({
                        text: "D. UNDERWRITING PERIOD",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.underwritingPeriod
                    }),
                    
                    // Subsection E
                    new Paragraph({
                        text: "E. UNDERWRITING REVIEW",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.underwritingReview
                    }),
                    
                    // Subsection F
                    new Paragraph({
                        text: "F. REVISIONS AND FINAL REPORT",
                        heading: HeadingLevel.HEADING_3,
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }),
                    new Paragraph({
                        text: data.revisionsReport
                    }),
                    
                    // Section V
                    new Paragraph({
                        text: "V. SUBMISSION PROCESS",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    new Paragraph({
                        text: data.submissionProcess
                    }),
                    
                    // Section VI
                    new Paragraph({
                        text: "VI. QUESTIONS / INQUIRIES INFORMATION",
                        heading: HeadingLevel.HEADING_2,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    new Paragraph({
                        text: data.inquiries
                    }),
                ]
            }]
        });
        
        // Generate the document as a blob
        docx.Packer.toBlob(doc).then(blob => {
            // Save the blob as a file
            const filename = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_grant_rfp.docx`;
            saveAs(blob, filename);
        });
    }

    // Function to parse timeline content and check for table structure
    function parseTimelineContent(timelineContent) {
        const elements = [];
        
        // Check if the content contains table markers
        if (timelineContent.includes('|') && timelineContent.includes('ACTIVITY') && timelineContent.includes('PROJECTED DATE')) {
            try {
                // Try to parse as a table
                const { Document, Paragraph, Table, TableRow, TableCell, TextRun, BorderStyle } = docx;
                
                // Find table rows
                const lines = timelineContent.split('\n')
                    .filter(line => line.trim().length > 0)
                    .filter(line => line.includes('|'));
                
                // If we have rows, create a table
                if (lines.length >= 2) {
                    const tableRows = [];
                    
                    // Find the separator row (row with just dashes, pipes, colons, and spaces)
                    let separatorRowIndex = -1;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        // Check if this is a separator row
                        if (/^[\|\-\:\s]+$/.test(line)) {
                            separatorRowIndex = i;
                            break;
                        }
                    }
                    
                    // Process each line, skipping the separator row
                    lines.forEach((line, index) => {
                        // Skip separator row with dashes
                        if (index === separatorRowIndex) {
                            return;
                        }
                        
                        // Skip lines that are just formatting and don't have actual content
                        if (line.replace(/\|/g, '').trim().replace(/-/g, '').replace(/:/g, '').length === 0) {
                            return;
                        }
                        
                        // Split cells
                        const cells = line.split('|')
                            .filter(cell => cell.trim().length > 0)
                            .map(cell => cell.trim());
                        
                        if (cells.length >= 2) {
                            const tableCells = cells.map(cellText => {
                                return new TableCell({
                                    children: [new Paragraph(cellText)],
                                    width: {
                                        size: 100 / cells.length,
                                        type: "pct",
                                    }
                                });
                            });
                            
                            const isHeader = index === 0;
                            const row = new TableRow({ 
                                children: tableCells,
                                tableHeader: isHeader
                            });
                            
                            tableRows.push(row);
                        }
                    });
                    
                    if (tableRows.length > 0) {
                        elements.push(
                            new Table({
                                width: {
                                    size: 100,
                                    type: "pct",
                                },
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1 },
                                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                                    left: { style: BorderStyle.SINGLE, size: 1 },
                                    right: { style: BorderStyle.SINGLE, size: 1 },
                                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                                    insideVertical: { style: BorderStyle.SINGLE, size: 1 }
                                },
                                rows: tableRows
                            })
                        );
                        return elements;
                    }
                }
            } catch (err) {
                console.error('Error parsing timeline table:', err);
            }
        }
        
        // Fallback: just add as plain text
        elements.push(new Paragraph({ text: timelineContent }));
        return elements;
    }

    // Function to format the output based on document type
    function formatOutput(content, outputType) {
        let formattedContent = '';

        if (outputType === 'pdf' || outputType === 'docx' || outputType === 'grant') {
            // Format content for documents and grant proposals
            
            // Process tables first (before other markdown processing)
            formattedContent = parseAndFormatTables(content);
            
            // Process markdown-style headings and formatting
            formattedContent = formattedContent
                .replace(/# (.*)/g, '<h1>$1</h1>')
                .replace(/## (.*)/g, '<h2>$1</h2>')
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
                
            // Apply specific styles for grant proposals
            if (outputType === 'grant') {
                formattedContent = `<div class="document-container grant-proposal">${formattedContent}</div>`;
            } else {
                // Wrap in document container for other document types
                formattedContent = `<div class="document-container">${formattedContent}</div>`;
            }
        } else if (outputType === 'ppt') {
            // Format content for presentations
            const slideMatches = content.match(/Slide \d+:.*?(?=Slide \d+:|$)/gs);
            
            if (slideMatches && slideMatches.length > 0) {
                formattedContent = '<div class="slides">';
                
                slideMatches.forEach((slide, index) => {
                    const slideNumber = index + 1;
                    const slideTitle = slide.match(/Slide \d+:(.*?)(?:\n|$)/);
                    const slideContent = slide.replace(/Slide \d+:.*?\n/, '').trim();
                    
                    formattedContent += `
                        <div class="slide">
                            <h3>${slideTitle ? slideTitle[1].trim() : `Slide ${slideNumber}`}</h3>
                            <div class="slide-content">
                                ${slideContent.replace(/• (.*)/g, '<li>$1</li>').replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                });
                
                formattedContent += '</div>';
            } else {
                // Fallback if the expected format isn't found
                const slides = content.split(/Slide \d+:/i);
                
                if (slides.length > 1) {
                    formattedContent = '<div class="slides">';
                    
                    for (let i = 1; i < slides.length; i++) {
                        formattedContent += `
                            <div class="slide">
                                <h3>Slide ${i}</h3>
                                <div class="slide-content">
                                    ${slides[i].replace(/• (.*)/g, '<li>$1</li>').replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        `;
                    }
                    
                    formattedContent += '</div>';
                } else {
                    formattedContent = content.replace(/\n/g, '<br>');
                }
            }
        } else if (outputType === 'x') {
            // Format content for Twitter
            const postMatch = content.match(/POST:(.*?)(?=HASHTAGS:|$)/s);
            const hashtagsMatch = content.match(/HASHTAGS:(.*?)(?=ENGAGEMENT PROMPT:|$)/s);
            const engagementMatch = content.match(/ENGAGEMENT PROMPT:(.*?)$/s);
            
            const post = postMatch ? postMatch[1].trim() : '';
            const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';
            const engagement = engagementMatch ? engagementMatch[1].trim() : '';
            
            formattedContent = `
                <div class="social-post x-post">
                    <div class="post-content">${post.replace(/\n/g, '<br>')}</div>
                    <div class="hashtags">${hashtags.replace(/\n/g, ' ')}</div>
                    <div class="engagement">${engagement.replace(/\n/g, '<br>')}</div>
                </div>
            `;
        } else if (outputType === 'instagram') {
            // Format content for Instagram
            const captionMatch = content.match(/CAPTION:(.*?)(?=HASHTAGS:|$)/s);
            const hashtagsMatch = content.match(/HASHTAGS:(.*?)$/s);
            
            const caption = captionMatch ? captionMatch[1].trim() : '';
            const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';
            
            formattedContent = `
                <div class="social-post instagram-post">
                    <div class="caption">${caption.replace(/\n/g, '<br>')}</div>
                    <div class="hashtags">${hashtags.replace(/\n/g, ' ')}</div>
                </div>
            `;
        } else {
            // Default formatting
            formattedContent = content.replace(/\n/g, '<br>');
        }

        outputContent.innerHTML = formattedContent;
        
        // Set up the text selection handler
        setupTextSelectionHandler();
    }
    
    // Function to handle text selection in the document
    function setupTextSelectionHandler() {
        // Create the selection query box if it doesn't exist
        if (!document.getElementById('selectionQueryBox')) {
            const selectionBox = document.createElement('div');
            selectionBox.id = 'selectionQueryBox';
            selectionBox.className = 'selection-query-box hidden';
            selectionBox.innerHTML = `
                <div class="selection-query-content">
                    <div class="selected-text-preview">
                        <strong>Selected text:</strong>
                        <div class="preview-content"></div>
                    </div>
                    <textarea placeholder="How would you like to modify this text?"></textarea>
                    <div id="selectionEditStatus" class="hidden">
                        <div class="spinner"></div>
                        <span>Applying edit...</span>
                    </div>
                    <button class="action-btn" id="applySelectionEdit">Apply Edit</button>
                </div>
            `;
            document.body.appendChild(selectionBox);
            
            // Add click handler for the edit button
            document.getElementById('applySelectionEdit').addEventListener('click', function() {
                const queryText = document.querySelector('#selectionQueryBox textarea').value;
                
                if (queryText.trim() === '') {
                    alert('Please enter your query about the selected text.');
                    return;
                }
                
                // Get the stored selection from the data attribute
                const selectionData = JSON.parse(selectionBox.getAttribute('data-selection'));
                if (!selectionData || !selectionData.text) {
                    alert('Selection data was lost. Please try selecting text again.');
                    hideSelectionQueryBox();
                    return;
                }
                
                // Update with the current query
                selectionData.query = queryText;
                
                // Show loading indicator
                const statusEl = document.getElementById('selectionEditStatus');
                statusEl.classList.remove('hidden');
                statusEl.style.display = 'flex';
                
                // Disable the edit button while processing
                document.getElementById('applySelectionEdit').disabled = true;
                
                // Get the entire document content for context
                const documentContext = outputContentDiv.textContent;
                
                // Send to API for processing
                processSelectedTextEdit(selectionData, documentContext);
            });
        }
        
        // Add selection event listener to the output content
        const outputContainer = document.getElementById('output-content');
        if (outputContainer) {
            outputContainer.addEventListener('mouseup', handleTextSelection);
            
            // Handle clicks outside the selection box to hide it
            document.addEventListener('mousedown', function(e) {
                const selectionBox = document.getElementById('selectionQueryBox');
                if (selectionBox && !selectionBox.contains(e.target) && e.target.id !== 'applySelectionEdit') {
                    // Small delay to allow for text selection to register
                    setTimeout(() => {
                        const selection = window.getSelection();
                        if (selection.toString().trim() === '') {
                            hideSelectionQueryBox();
                        }
                    }, 100);
                }
            });
        }
    }
    
    // Function to handle text selection
    function handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // If there's selected text, show the query box
        if (selectedText.length > 0) {
            const selectionBox = document.getElementById('selectionQueryBox');
            
            // Store the selection data immediately
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                
                // Store the range information as a serializable object
                // (since Range objects can't be directly serialized)
                const rangeRect = range.getBoundingClientRect();
                const selectionData = {
                    text: selectedText,
                    rangeInfo: {
                        startContainer: getPathToNode(range.startContainer),
                        startOffset: range.startOffset,
                        endContainer: getPathToNode(range.endContainer),
                        endOffset: range.endOffset
                    }
                };
                
                // Store serialized selection data in the box's data attribute
                selectionBox.setAttribute('data-selection', JSON.stringify(selectionData));
                
                // Show the selected text in the preview
                const previewEl = selectionBox.querySelector('.preview-content');
                if (previewEl) {
                    // Truncate if too long
                    const maxLength = 100;
                    previewEl.textContent = selectedText.length > maxLength 
                        ? selectedText.substring(0, maxLength) + '...' 
                        : selectedText;
                }
                
                // Get the coordinates of the selection
                const rect = rangeRect;
                
                // Position the box below the selection
                const topPosition = rect.bottom + window.scrollY + 10; // 10px below selection
                const leftPosition = rect.left + window.scrollX;
                
                // Set the position and show the box
                selectionBox.style.top = `${topPosition}px`;
                selectionBox.style.left = `${leftPosition}px`;
                selectionBox.classList.remove('hidden');
                selectionBox.style.display = 'block';
                
                // Clear any previous text
                document.querySelector('#selectionQueryBox textarea').value = '';
            }
        }
    }
    
    // Helper function to get a path to a DOM node that can be used to retrieve it later
    function getPathToNode(node) {
        // If it's a text node, use its parent element
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        // Simple approach: get a unique identifier or generate one
        if (node.id) {
            return { type: 'id', value: node.id };
        }
        
        // If no ID, use position within parent
        const parent = node.parentElement;
        if (parent) {
            const children = Array.from(parent.children);
            const index = children.indexOf(node);
            return { 
                type: 'index', 
                index: index,
                parentPath: getPathToNode(parent)
            };
        }
        
        // Fallback
        return { type: 'unknown' };
    }
    
    // Function to process the selected text edit
    async function processSelectedTextEdit(selectionData, documentContext) {
        try {
            // Safely get the grant type
            const grantTypeElement = document.getElementById('grantType');
            const grantType = grantTypeElement ? grantTypeElement.value : 'rfp';
            
            // Get the full document HTML
            const fullDocument = outputContentDiv.innerHTML;
            
            // Call the selective edit API
            const response = await fetch('/api/selective-edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    selectedText: selectionData.text,
                    query: selectionData.query,
                    fullDocument: fullDocument,
                    grantType: grantType
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to process selective edit');
            }
            
            const data = await response.json();
            
            // Update the entire document with the edited version
            updateEntireDocument(data.editedDocument);
            
            // Hide the selection box and reset
            hideSelectionQueryBox();
            
            // Show success message
            alert('Text edited successfully!');
        } catch (error) {
            console.error('Error processing selective edit:', error);
            alert(`Error editing text: ${error.message}`);
        } finally {
            // Hide loading indicator
            const statusEl = document.getElementById('selectionEditStatus');
            if (statusEl) {
                statusEl.classList.add('hidden');
                statusEl.style.display = 'none';
            }
            
            // Re-enable the edit button
            const editBtn = document.getElementById('applySelectionEdit');
            if (editBtn) {
                editBtn.disabled = false;
            }
        }
    }
    
    // Function to update the entire document with the edited version
    function updateEntireDocument(editedDocument) {
        // Update the output content with the edited document
        outputContentDiv.innerHTML = editedDocument;
        
        // Re-setup the text selection handler for the updated content
        setupTextSelectionHandler();
    }
    
    // Function to replace the selected text with edited text
    function replaceSelectedText(rangeInfo, newText) {
        try {
            // Try to recreate the range from the stored information
            const range = recreateRange(rangeInfo);
            
            if (range) {
                // Delete the selected content
                range.deleteContents();
                
                // Insert the new text
                const textNode = document.createTextNode(newText);
                range.insertNode(textNode);
                
                // Collapse the selection to the end
                range.collapse(false);
                
                // Clear any existing selections
                window.getSelection().removeAllRanges();
            } else {
                // If we can't recreate the range, just insert at the cursor or update a focused element
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.isContentEditable || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                    // If an editable element is focused, replace text there
                    const start = activeElement.selectionStart || 0;
                    const end = activeElement.selectionEnd || 0;
                    if (start !== end) {
                        activeElement.value = activeElement.value.substring(0, start) + newText + activeElement.value.substring(end);
                    } else {
                        alert('Text was edited but original selection location could not be determined. The edited text is: ' + newText);
                    }
                } else {
                    alert('Text was edited but original selection location could not be determined. The edited text is: ' + newText);
                }
            }
        } catch (error) {
            console.error('Error replacing selected text:', error);
            alert('Error updating text. The edited text is: ' + newText);
        }
    }
    
    // Helper function to recreate a Range from stored path information
    function recreateRange(rangeInfo) {
        try {
            // Find the start and end containers from their paths
            const startContainer = findNodeByPath(rangeInfo.startContainer);
            const endContainer = findNodeByPath(rangeInfo.endContainer);
            
            if (!startContainer || !endContainer) {
                return null;
            }
            
            // Create a new range
            const range = document.createRange();
            
            // Set the start and end positions
            range.setStart(startContainer, rangeInfo.startOffset);
            range.setEnd(endContainer, rangeInfo.endOffset);
            
            return range;
        } catch (error) {
            console.error('Error recreating range:', error);
            return null;
        }
    }
    
    // Helper function to find a node by its stored path
    function findNodeByPath(pathInfo) {
        if (!pathInfo) return null;
        
        if (pathInfo.type === 'id') {
            return document.getElementById(pathInfo.value);
        }
        
        if (pathInfo.type === 'index' && pathInfo.parentPath) {
            const parent = findNodeByPath(pathInfo.parentPath);
            if (parent && parent.children && pathInfo.index < parent.children.length) {
                return parent.children[pathInfo.index];
            }
        }
        
        // Fallback: just search in the output container
        return document.getElementById('output-content');
    }
    
    // Function to hide the selection query box
    function hideSelectionQueryBox() {
        const selectionBox = document.getElementById('selectionQueryBox');
        if (selectionBox) {
            selectionBox.classList.add('hidden');
            selectionBox.style.display = 'none';
        }
    }

    // Function to parse and format tables
    function parseAndFormatTables(content) {
        // Split content into sections (table and non-table)
        const sections = [];
        let currentSection = '';
        let insideTable = false;
        
        // Split the content by lines
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect table start (line containing multiple pipe characters)
            if (!insideTable && line.includes('|') && line.split('|').length > 2) {
                // Save current non-table section if exists
                if (currentSection.trim()) {
                    sections.push({ type: 'text', content: currentSection });
                    currentSection = '';
                }
                
                insideTable = true;
                currentSection = line + '\n';
            } 
            // Inside table - continue collecting table lines
            else if (insideTable) {
                // If no longer a table row, end the table
                if (!line.includes('|')) {
                    sections.push({ type: 'table', content: currentSection });
                    currentSection = line + '\n';
                    insideTable = false;
                } else {
                    currentSection += line + '\n';
                }
            } 
            // Outside table - collect regular text
            else {
                currentSection += line + '\n';
            }
        }
        
        // Add the last section
        if (currentSection.trim()) {
            sections.push({ 
                type: insideTable ? 'table' : 'text', 
                content: currentSection 
            });
        }
        
        // Process each section and combine
        return sections.map(section => {
            if (section.type === 'table') {
                return convertMarkdownTableToHTML(section.content);
            }
            return section.content;
        }).join('');
    }

    // Function to convert markdown table to HTML
    function convertMarkdownTableToHTML(tableText) {
        // Split into rows
        const rows = tableText.trim().split('\n');
        
        if (rows.length < 2) return tableText;
        
        let html = '<table class="content-table">';
        
        // Create table header first
        const headerRow = rows[0];
        if (headerRow.includes('|')) {
            const headerCells = headerRow.split('|')
                .filter((cell, index, array) => index > 0 && index < array.length - 1 || (index === 0 && cell.trim().length > 0) || (index === array.length - 1 && cell.trim().length > 0))
                .map(cell => cell.trim());
            
            if (headerCells.length > 0) {
                html += '<thead><tr>';
                headerCells.forEach(cell => {
                    html += `<th>${cell}</th>`;
                });
                html += '</tr></thead>';
            }
        }
        
        // Now process the body rows, skipping the separator row
        html += '<tbody>';
        
        // Find the separator row index (usually the second row)
        let separatorRowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // Check if this is a separator row (only contains |, -, :, or spaces)
            if (/^[\|\-\:\s]+$/.test(row)) {
                separatorRowIndex = i;
                break;
            }
        }
        
        // Process each data row, skipping the separator row
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
            // Skip the separator row
            if (rowIndex === separatorRowIndex) {
                continue;
            }
            
            const row = rows[rowIndex];
            if (!row.includes('|')) continue;
            
            // Clean the row data
            const cells = row.split('|')
                .filter((cell, index, array) => index > 0 && index < array.length - 1 || (index === 0 && cell.trim().length > 0) || (index === array.length - 1 && cell.trim().length > 0))
                .map(cell => cell.trim());
            
            if (cells.length === 0) continue;
            
            html += '<tr>';
            cells.forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        return html;
    }

    // Helper function to escape HTML content
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Function to suggest edits to document content
    async function suggestDocumentEdits(documentHtml, outputType) {
        try {
            // Create loading indicator
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = '<div class="spinner"></div><p>Analyzing document for suggestions...</p>';
            document.body.appendChild(loadingOverlay);
            
            // Send document to API for review
            const response = await fetch('/api/review-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentHtml: documentHtml
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to review document');
            }
            
            const data = await response.json();
            
            // Remove loading overlay
            document.body.removeChild(loadingOverlay);
            
            // Display suggestions
            displaySuggestions(data.suggestions, documentHtml, outputType);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error suggesting edits: ${error.message}`);
            
            // Remove loading overlay if it exists
            const overlay = document.querySelector('.loading-overlay');
            if (overlay) {
                document.body.removeChild(overlay);
            }
        }
    }
    
    // Function to display suggestions in a modal
    function displaySuggestions(suggestions, documentHtml, outputType) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // If no suggestions, show message
        if (!suggestions || suggestions.length === 0) {
            modal.innerHTML = `
                <div class="modal-content suggestions-modal">
                    <div class="modal-header">
                        <h2>Document Review</h2>
                        <span class="close-suggestions-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="suggestions-container">
                            <div class="no-suggestions">
                                <i class="fas fa-check-circle"></i>
                                <p>No issues found in the document. Everything looks good!</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Create suggestions HTML
            const suggestionsHtml = suggestions.map((suggestion, index) => `
                <div class="suggestion-item" data-index="${index}">
                    <div class="suggestion-header">
                        <h3>Issue ${index + 1}</h3>
                        <div class="suggestion-controls">
                            <button class="accept-suggestion" data-index="${index}">
                                <i class="fas fa-check"></i> Accept
                            </button>
                            <button class="reject-suggestion" data-index="${index}">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </div>
                    <div class="suggestion-problem">
                        <strong>Problem:</strong>
                        <p>${escapeHtml(suggestion.problem)}</p>
                    </div>
                    <div class="suggestion-reason">
                        <strong>Reason:</strong>
                        <p>${escapeHtml(suggestion.reason)}</p>
                    </div>
                    <div class="suggestion-correction">
                        <strong>Suggestion:</strong>
                        <p>${escapeHtml(suggestion.suggestion)}</p>
                    </div>
                </div>
            `).join('');
            
            modal.innerHTML = `
                <div class="modal-content suggestions-modal">
                    <div class="modal-header">
                        <h2>Document Review Suggestions</h2>
                        <span class="close-suggestions-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="suggestions-container">
                            ${suggestionsHtml}
                        </div>
                        <div class="suggestions-actions">
                            <button id="acceptAllSuggestions" class="action-btn">
                                <i class="fas fa-check-double"></i> Accept All
                            </button>
                            <button id="rejectAllSuggestions" class="action-btn secondary-btn">
                                <i class="fas fa-times-circle"></i> Reject All
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add modal to body
        document.body.appendChild(modal);
        
        // Make modal visible
        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);
        
        // Close modal when clicking on X
        const closeBtn = modal.querySelector('.close-suggestions-modal');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
        
        // Close modal when clicking outside content
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 300);
            }
        });
        
        // If there are suggestions, add event listeners for accept/reject buttons
        if (suggestions && suggestions.length > 0) {
            // Store original document HTML
            const originalHtml = documentHtml;
            let currentHtml = originalHtml;
            
            // Accept single suggestion
            const acceptButtons = modal.querySelectorAll('.accept-suggestion');
            acceptButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const index = parseInt(button.getAttribute('data-index'));
                    const suggestion = suggestions[index];
                    
                    // Apply this suggestion to the current HTML
                    currentHtml = applySuggestion(currentHtml, suggestion);
                    
                    // Update the document with the new HTML
                    outputContent.innerHTML = currentHtml;
                    
                    // Mark as accepted and disable buttons
                    const suggestionItem = button.closest('.suggestion-item');
                    suggestionItem.classList.add('accepted');
                    suggestionItem.querySelector('.suggestion-controls').innerHTML = 
                        '<span class="suggestion-status">✓ Applied</span>';
                });
            });
            
            // Reject single suggestion
            const rejectButtons = modal.querySelectorAll('.reject-suggestion');
            rejectButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Mark as rejected and disable buttons
                    const suggestionItem = button.closest('.suggestion-item');
                    suggestionItem.classList.add('rejected');
                    suggestionItem.querySelector('.suggestion-controls').innerHTML = 
                        '<span class="suggestion-status">✗ Rejected</span>';
                });
            });
            
            // Accept all suggestions
            const acceptAllBtn = modal.querySelector('#acceptAllSuggestions');
            acceptAllBtn.addEventListener('click', () => {
                // Apply all suggestions
                let updatedHtml = originalHtml;
                suggestions.forEach(suggestion => {
                    updatedHtml = applySuggestion(updatedHtml, suggestion);
                });
                
                // Update the document with the new HTML
                outputContent.innerHTML = updatedHtml;
                
                // Mark all as accepted
                modal.querySelectorAll('.suggestion-item').forEach(item => {
                    item.classList.add('accepted');
                    item.querySelector('.suggestion-controls').innerHTML = 
                        '<span class="suggestion-status">✓ Applied</span>';
                });
                
                // Show success message
                const actionsDiv = modal.querySelector('.suggestions-actions');
                actionsDiv.innerHTML = '<div class="success-message">All suggestions applied successfully!</div>';
            });
            
            // Reject all suggestions
            const rejectAllBtn = modal.querySelector('#rejectAllSuggestions');
            rejectAllBtn.addEventListener('click', () => {
                // Mark all as rejected
                modal.querySelectorAll('.suggestion-item').forEach(item => {
                    item.classList.add('rejected');
                    item.querySelector('.suggestion-controls').innerHTML = 
                        '<span class="suggestion-status">✗ Rejected</span>';
                });
                
                // Show message
                const actionsDiv = modal.querySelector('.suggestions-actions');
                actionsDiv.innerHTML = '<div class="neutral-message">All suggestions rejected.</div>';
            });
        }
    }
    
    // Function to apply a suggestion to HTML content
    function applySuggestion(html, suggestion) {
        // Check if we have valid inputs
        if (!html || !suggestion || !suggestion.problem || !suggestion.suggestion) {
            console.error("Invalid inputs for applySuggestion:", {html: !!html, suggestion});
            return html;
        }
        
        try {
            // Simple text replacement with safeguards to preserve HTML
            // We do a direct string replacement but track the positions to avoid breaking HTML tags
            const problemText = suggestion.problem;
            const replacementText = suggestion.suggestion;
            
            // Helper function to find a string in text without breaking HTML tags
            function safeReplace(html, search, replace) {
                // Split the HTML into tag and text segments
                let parts = html.split(/(<[^>]*>)/g);
                
                // Only replace text in non-tag parts
                for (let i = 0; i < parts.length; i++) {
                    // Skip tag parts (they start with < and end with >)
                    if (parts[i].startsWith('<') && parts[i].endsWith('>')) {
                        continue;
                    }
                    
                    // Replace in text parts
                    if (parts[i].includes(search)) {
                        parts[i] = parts[i].replace(search, replace);
                        return parts.join(''); // Return once we've made one replacement
                    }
                }
                
                // No exact match found, try case-insensitive if necessary
                const searchRegex = new RegExp(escapeRegExp(search), 'i');
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].startsWith('<') && parts[i].endsWith('>')) {
                        continue;
                    }
                    
                    if (searchRegex.test(parts[i])) {
                        parts[i] = parts[i].replace(searchRegex, replace);
                        return parts.join('');
                    }
                }
                
                // If no replacement made, return original
                return html;
            }
            
            // Apply the replacement in a way that preserves HTML
            const result = safeReplace(html, problemText, replacementText);
            
            // Log for debugging
            console.log("Suggestion applied:", {
                problem: problemText, 
                replacement: replacementText,
                changed: result !== html
            });
            
            return result;
        } catch (error) {
            console.error("Error applying suggestion:", error);
            return html; // Return original on error
        }
    }
    
    // Helper to escape special regex characters
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Document Version History Implementation
    // Store all versions of the document
    let documentVersions = [];
    let currentVersionIndex = -1;
    
    // Get version history elements
    const versionHistoryToggle = document.getElementById('versionHistoryToggle');
    const versionHistoryContainer = document.getElementById('versionHistoryContainer');
    const versionHistoryList = document.getElementById('versionHistoryList');
    const versionHistoryOverlay = document.getElementById('versionHistoryOverlay');
    const closeVersionHistory = document.getElementById('closeVersionHistory');
    const saveVersionBtn = document.getElementById('saveVersionBtn');
    
    // Initialize version history when a document is generated
    function initializeVersionHistory(content, outputType, grantType) {
        // Reset version history
        documentVersions = [];
        currentVersionIndex = -1;
        versionHistoryList.innerHTML = '';
        
        // Add initial version
        addDocumentVersion(content, 'Initial Version', outputType, grantType);
        
        // Make sure the version history toggle is visible
        versionHistoryToggle.classList.remove('hidden');
        versionHistoryToggle.style.display = 'block';
    }
    
    // Add a new version to the history
    function addDocumentVersion(content, description, outputType, grantType) {
        const timestamp = new Date();
        const version = {
            content,
            description,
            timestamp,
            outputType,
            grantType
        };
        
        // Add to versions array
        documentVersions.push(version);
        currentVersionIndex = documentVersions.length - 1;
        
        // Update UI
        renderVersionHistory();
    }
    
    // Render the version history list
    function renderVersionHistory() {
        versionHistoryList.innerHTML = '';
        
        documentVersions.forEach((version, index) => {
            const versionNode = document.createElement('div');
            versionNode.className = `version-node ${index === currentVersionIndex ? 'active' : ''}`;
            versionNode.dataset.index = index;
            
            // Format timestamp
            const timeFormatted = version.timestamp.toLocaleTimeString();
            const dateFormatted = version.timestamp.toLocaleDateString();
            
            versionNode.innerHTML = `
                <div class="version-title">
                    Version ${index + 1}
                    ${index === 0 ? '<span class="version-badge">Initial</span>' : ''}
                    ${index === documentVersions.length - 1 && index !== 0 ? '<span class="version-badge">Latest</span>' : ''}
                </div>
                <div class="version-timestamp">
                    ${dateFormatted} at ${timeFormatted}
                </div>
                <div class="version-description">${version.description}</div>
            `;
            
            // Add click event to view this version
            versionNode.addEventListener('click', () => {
                viewDocumentVersion(index);
            });
            
            versionHistoryList.appendChild(versionNode);
        });
    }
    
    // View a specific version of the document
    function viewDocumentVersion(index) {
        if (index < 0 || index >= documentVersions.length) return;
        
        // Update current index
        currentVersionIndex = index;
        
        // Get the version
        const version = documentVersions[index];
        
        // Update UI
        outputContent.innerHTML = version.content;
        
        // Add revert button if not viewing the latest version
        if (index < documentVersions.length - 1) {
            const revertBtn = document.createElement('button');
            revertBtn.className = 'action-btn';
            revertBtn.innerHTML = '<i class="fas fa-undo"></i> Revert to this version';
            revertBtn.addEventListener('click', () => {
                revertToVersion(index);
            });
            
            // Add the revert button to the top of the content
            const revertContainer = document.createElement('div');
            revertContainer.className = 'revert-container';
            revertContainer.appendChild(revertBtn);
            outputContent.insertBefore(revertContainer, outputContent.firstChild);
        }
        
        // Update UI highlighting
        const versionNodes = versionHistoryList.querySelectorAll('.version-node');
        versionNodes.forEach(node => {
            node.classList.toggle('active', parseInt(node.dataset.index) === index);
        });
    }
    
    // Revert to a previous version
    function revertToVersion(index) {
        if (index < 0 || index >= documentVersions.length) return;
        
        const confirmRevert = confirm('Are you sure you want to revert to this version? This will create a new version with the reverted content.');
        if (!confirmRevert) return;
        
        const version = documentVersions[index];
        addDocumentVersion(
            version.content, 
            `Reverted to Version ${index + 1}`, 
            version.outputType, 
            version.grantType
        );
        
        // View the newly created version
        viewDocumentVersion(documentVersions.length - 1);
    }
    
    // Save current document as a new version
    function saveCurrentVersion() {
        // Get the current document content
        const currentContent = outputContent.innerHTML;
        
        // Display a dialog to enter version description
        const description = prompt('Enter a description for this version:', 'Updated version');
        if (!description) return; // User cancelled
        
        // Get current document type
        const currentVersion = documentVersions[currentVersionIndex];
        
        // Add as a new version
        addDocumentVersion(
            currentContent, 
            description, 
            currentVersion.outputType, 
            currentVersion.grantType
        );
        
        // View the newly created version
        viewDocumentVersion(documentVersions.length - 1);
    }
    
    // Event listeners for version history
    versionHistoryToggle.addEventListener('click', () => {
        console.log('Version history toggle clicked');
        versionHistoryContainer.classList.remove('hidden');
        versionHistoryOverlay.classList.add('visible');
        document.getElementById('output-container').classList.add('with-version-history');
        
        // Force a redraw of the version history
        renderVersionHistory();
    });
    
    closeVersionHistory.addEventListener('click', () => {
        console.log('Close version history clicked');
        versionHistoryContainer.classList.add('hidden');
        versionHistoryOverlay.classList.remove('visible');
        document.getElementById('output-container').classList.remove('with-version-history');
    });
    
    versionHistoryOverlay.addEventListener('click', () => {
        closeVersionHistory.click();
    });
    
    saveVersionBtn.addEventListener('click', saveCurrentVersion);
    
    // Hook into the existing document generation flow
    const originalFormatOutput = formatOutput;
    formatOutput = function(content, outputType) {
        const formattedContent = originalFormatOutput(content, outputType);
        
        // Initialize version history after first generation
        if (formattedContent && outputType) {
            // Ensure this executes after the content is rendered
            setTimeout(() => {
                initializeVersionHistory(formattedContent, outputType, grantTypeSelect.value);
                console.log('Version history initialized');
            }, 500);
        }
        
        return formattedContent;
    };
    
    // Hook into the edit content save function
    const originalSaveEditsEvent = saveEditsBtn.onclick;
    saveEditsBtn.onclick = function(event) {
        if (typeof originalSaveEditsEvent === 'function') {
            originalSaveEditsEvent.call(this, event);
        }
        
        // After saving edits, automatically create a new version
        setTimeout(() => {
            if (documentVersions.length > 0) {
                const currentContent = outputContent.innerHTML;
                addDocumentVersion(
                    currentContent, 
                    'Edited content', 
                    documentVersions[currentVersionIndex].outputType, 
                    documentVersions[currentVersionIndex].grantType
                );
                viewDocumentVersion(documentVersions.length - 1);
            }
        }, 500);
    };
    
    // Also hook into suggestDocumentEdits to track changes
    const originalApplySuggestion = applySuggestion;
    applySuggestion = function(html, suggestion) {
        const result = originalApplySuggestion(html, suggestion);
        
        // After applying an AI suggestion, create a new version
        setTimeout(() => {
            if (documentVersions.length > 0) {
                const currentContent = outputContent.innerHTML;
                addDocumentVersion(
                    currentContent, 
                    'Applied AI suggestion', 
                    documentVersions[currentVersionIndex].outputType, 
                    documentVersions[currentVersionIndex].grantType
                );
                viewDocumentVersion(documentVersions.length - 1);
            }
        }, 500);
        
        return result;
    };

}); // End of DOMContentLoaded