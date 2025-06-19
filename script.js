document.addEventListener('DOMContentLoaded', () => {
    const tierList = document.getElementById('tierList');
    const itemPool = document.getElementById('itemPool');
    const addTierButton = document.getElementById('addTier');
    const addItemButton = document.getElementById('addItem');
    const saveTierlistButton = document.getElementById('saveTierlist');
    const loadTierlistButton = document.getElementById('loadTierlist');
    const loadTierlistInput = document.getElementById('loadTierlistInput');
    const saveScreenshotButton = document.getElementById('saveScreenshot');
    const itemPoolCounter = document.getElementById('itemPoolCounter');

    // Modal elements
    const addItemModal = document.getElementById('addItemModal');
    const addItemForm = document.getElementById('addItemForm');
    const itemNameInput = document.getElementById('itemName');
    const itemImageInput = document.getElementById('itemImage');
    const imagePreview = document.getElementById('imagePreview');
    const cancelAddItem = document.getElementById('cancelAddItem');

    // Initial tiers with their default colors
    const initialTiers = [
        { name: 'S', color: '#FF4D4D' },
        { name: 'A', color: '#FF8C1A' },
        { name: 'B', color: '#FFD700' },
        { name: 'C', color: '#4DB8FF' },
        { name: 'D', color: '#4D94FF' },
        { name: 'F', color: '#8C66FF' }
    ];

    let itemCounter = 1;

    // For custom drag
    let dragData = null;
    let dragPreview = null;
    let dragType = null; // 'item' or 'tier'
    let dragOrigin = null;
    let dragGhost = null;
    let animationFrame = null;
    let lerpX = 0, lerpY = 0, targetX = 0, targetY = 0;
    const lerpSpeedItem = 0.6;
    let tierInitialX = 0;
    let isMoving = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Track hovered item/tier
    let hoveredElement = null;

    // --- Tierlist Title Editing ---
    const tierlistTitle = document.getElementById('tierlistTitle');
    const editTitleBtn = document.getElementById('editTitleBtn');
    let currentTierlistTitle = 'Untitled Tierlist';

    function setTierlistTitle(title) {
        currentTierlistTitle = title;
        tierlistTitle.textContent = title;
    }
    editTitleBtn.addEventListener('click', () => {
        const newTitle = prompt('Enter tierlist title:', currentTierlistTitle);
        if (newTitle && newTitle.trim()) setTierlistTitle(newTitle.trim());
    });
    setTierlistTitle('Untitled Tierlist');

    // --- Developer Tools Toggle ---
    const devToolsToggle = document.getElementById('devToolsToggle');
    let devToolsEnabled = false;
    devToolsToggle.addEventListener('change', () => {
        devToolsEnabled = devToolsToggle.checked;
        document.querySelectorAll('.item-edit-icon').forEach(icon => {
            icon.style.display = devToolsEnabled ? '' : 'none';
        });
    });

    // --- Item Edit Modal ---
    let editItemModal = null;
    function showEditItemModal(item) {
        if (editItemModal) editItemModal.remove();
        editItemModal = document.createElement('div');
        editItemModal.className = 'modal';
        editItemModal.style.display = 'flex';
        editItemModal.innerHTML = `
            <div class="modal-content">
                <h3>Edit Item</h3>
                <form id="editItemForm">
                    <label for="editItemName">Name:</label>
                    <input type="text" id="editItemName" name="editItemName" required maxlength="32" autocomplete="off" value="${item.getAttribute('data-name') || ''}" />
                    <label for="editItemImage">Image:</label>
                    <input type="file" id="editItemImage" name="editItemImage" accept="image/*" />
                    <div class="image-preview" id="editImagePreview"></div>
                    <div class="modal-actions">
                        <button type="submit">Save</button>
                        <button type="button" id="cancelEditItem">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(editItemModal);
        const form = editItemModal.querySelector('#editItemForm');
        const nameInput = editItemModal.querySelector('#editItemName');
        const imageInput = editItemModal.querySelector('#editItemImage');
        const preview = editItemModal.querySelector('#editImagePreview');
        const cancelBtn = editItemModal.querySelector('#cancelEditItem');
        // Show current image
        const img = item.querySelector('img');
        if (img) {
            const previewImg = document.createElement('img');
            previewImg.src = img.src;
            previewImg.style.maxWidth = '100%';
            previewImg.style.maxHeight = '100%';
            preview.appendChild(previewImg);
        }
        // Handle image change
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                preview.innerHTML = '';
                const previewImg = document.createElement('img');
                previewImg.src = ev.target.result;
                previewImg.style.maxWidth = '100%';
                previewImg.style.maxHeight = '100%';
                preview.appendChild(previewImg);
            };
            reader.readAsDataURL(file);
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            // Update name
            const newName = nameInput.value.trim();
            if (newName) {
                item.setAttribute('data-name', newName);
                const label = item.querySelector('.item-label');
                if (label) label.textContent = newName;
            }
            // Update image if changed
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    item.setAttribute('data-img', ev.target.result);
                    const img = item.querySelector('img');
                    if (img) img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
            editItemModal.remove();
        });
        cancelBtn.addEventListener('click', () => {
            editItemModal.remove();
        });
    }

    function updateItemPoolCounter() {
        const poolCount = itemPool.children.length;
        let total = poolCount;
        document.querySelectorAll('.tier-content').forEach(tc => {
            total += tc.children.length;
        });
        itemPoolCounter.textContent = `${poolCount} / ${total}`;
    }

    // Call updateItemPoolCounter after any item change
    const observer = new MutationObserver(updateItemPoolCounter);

    // Add hover listeners to items and tiers
    function addHoverListeners(el) {
        el.addEventListener('mouseenter', () => { hoveredElement = el; });
        el.addEventListener('mouseleave', () => { if (hoveredElement === el) hoveredElement = null; });
    }

    // Patch createItem to add hover listeners and zoom icon (patch only once)
    const baseCreateItem = createItem;
    createItem = function(...args) {
        const item = baseCreateItem.apply(this, args);
        // Add hover listeners
        addHoverListeners(item);
        // Add zoom icon
        const img = item.querySelector('img');
        let zoomIcon = item.querySelector('.zoom-icon');
        if (!zoomIcon) {
            zoomIcon = document.createElement('div');
            zoomIcon.className = 'zoom-icon';
            zoomIcon.innerHTML = `<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="7" stroke="#e0e0e0" stroke-width="2" fill="none"/><line x1="14" y1="14" x2="19" y2="19" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round"/></svg>`;
            item.appendChild(zoomIcon);
        }
        zoomIcon.onclick = (e) => {
            e.stopPropagation();
            showImagePopup(img.src, item.getAttribute('data-name'));
        };
        // Add edit pencil icon (only if devToolsEnabled)
        let editIcon = item.querySelector('.item-edit-icon');
        if (!editIcon) {
            editIcon = document.createElement('div');
            editIcon.className = 'item-edit-icon';
            editIcon.title = 'Edit item';
            editIcon.style.display = devToolsEnabled ? '' : 'none';
            editIcon.style.position = 'absolute';
            editIcon.style.top = '4px';
            editIcon.style.right = '26px';
            editIcon.style.width = '18px';
            editIcon.style.height = '18px';
            editIcon.style.background = 'rgba(30,30,30,0.85)';
            editIcon.style.borderRadius = '50%';
            editIcon.style.display = devToolsEnabled ? '' : 'none';
            editIcon.style.alignItems = 'center';
            editIcon.style.justifyContent = 'center';
            editIcon.style.cursor = 'pointer';
            editIcon.style.zIndex = '2';
            editIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 20 20"><path d="M14.69 2.86a2.1 2.1 0 0 1 2.97 2.97l-9.5 9.5-3.12.44a1 1 0 0 1-1.13-1.13l.44-3.12 9.5-9.5zm1.41 1.41l-1.41-1.41-9.5 9.5-.44 3.12 3.12-.44 9.5-9.5z" fill="#e0e0e0"/></svg>`;
            item.appendChild(editIcon);
        }
        editIcon.onclick = (e) => {
            e.stopPropagation();
            showEditItemModal(item);
        };
        return item;
    };
    // Patch createItemFromData to add hover listeners and zoom icon (patch only once)
    const baseCreateItemFromData = createItemFromData;
    createItemFromData = function(...args) {
        const item = baseCreateItemFromData.apply(this, args);
        // Add hover listeners
        addHoverListeners(item);
        // Add zoom icon
        const img = item.querySelector('img');
        let zoomIcon = item.querySelector('.zoom-icon');
        if (!zoomIcon) {
            zoomIcon = document.createElement('div');
            zoomIcon.className = 'zoom-icon';
            zoomIcon.innerHTML = `<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="7" stroke="#e0e0e0" stroke-width="2" fill="none"/><line x1="14" y1="14" x2="19" y2="19" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round"/></svg>`;
            item.appendChild(zoomIcon);
        }
        zoomIcon.onclick = (e) => {
            e.stopPropagation();
            showImagePopup(img.src, item.getAttribute('data-name'));
        };
        // Add edit pencil icon (only if devToolsEnabled)
        let editIcon = item.querySelector('.item-edit-icon');
        if (!editIcon) {
            editIcon = document.createElement('div');
            editIcon.className = 'item-edit-icon';
            editIcon.title = 'Edit item';
            editIcon.style.display = devToolsEnabled ? '' : 'none';
            editIcon.style.position = 'absolute';
            editIcon.style.top = '4px';
            editIcon.style.right = '26px';
            editIcon.style.width = '18px';
            editIcon.style.height = '18px';
            editIcon.style.background = 'rgba(30,30,30,0.85)';
            editIcon.style.borderRadius = '50%';
            editIcon.style.display = devToolsEnabled ? '' : 'none';
            editIcon.style.alignItems = 'center';
            editIcon.style.justifyContent = 'center';
            editIcon.style.cursor = 'pointer';
            editIcon.style.zIndex = '2';
            editIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 20 20"><path d="M14.69 2.86a2.1 2.1 0 0 1 2.97 2.97l-9.5 9.5-3.12.44a1 1 0 0 1-1.13-1.13l.44-3.12 9.5-9.5zm1.41 1.41l-1.41-1.41-9.5 9.5-.44 3.12 3.12-.44 9.5-9.5z" fill="#e0e0e0"/></svg>`;
            item.appendChild(editIcon);
        }
        editIcon.onclick = (e) => {
            e.stopPropagation();
            showEditItemModal(item);
        };
        return item;
    };

    // Add hover listeners to pool/tier items after loading
    function addHoverToAll() {
        document.querySelectorAll('.tier-item').forEach(addHoverListeners);
        document.querySelectorAll('.tier-row').forEach(addHoverListeners);
    }

    // Listen for Delete key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Del') {
            if (dragData) {
                // If dragging, delete the dragged element
                if (dragData.parentElement) dragData.parentElement.removeChild(dragData);
                dragData = null;
                if (dragPreview) { dragPreview.remove(); dragPreview = null; }
                if (animationFrame) cancelAnimationFrame(animationFrame);
                document.body.style.userSelect = '';
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            } else if (hoveredElement && hoveredElement.parentElement) {
                hoveredElement.parentElement.removeChild(hoveredElement);
                hoveredElement = null;
            }
        }
    });

    // Add hover listeners to initial items/tiers after DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        addHoverToAll();
    });

    // Create initial tiers
    initialTiers.forEach(tier => {
        createTier(tier.name, tier.color);
    });

    // Add new tier (show modal)
    addTierButton.addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.innerHTML = `
            <h3>Add New Tier</h3>
            <form id="addTierForm">
                <label for="tierName">Name:</label>
                <input type="text" id="tierName" name="tierName" required maxlength="32" autocomplete="off" />
                <label for="tierColor">Color:</label>
                <input type="color" id="tierColor" name="tierColor" value="#FF4D4D" style="width: 100%; height: 50px;">
                <label for="tierFontSize">Font Size (px):</label>
                <input type="number" id="tierFontSize" name="tierFontSize" min="12" max="64" value="24" style="width: 100%;">
                <div class="modal-actions">
                    <button type="submit">Add Tier</button>
                    <button type="button" id="cancelTier">Cancel</button>
                </div>
            </form>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        const form = content.querySelector('#addTierForm');
        const nameInput = content.querySelector('#tierName');
        const cancelBtn = content.querySelector('#cancelTier');
        
        nameInput.focus();
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const color = content.querySelector('#tierColor').value;
            const fontSize = parseInt(content.querySelector('#tierFontSize').value, 10) || 24;
            if (name) {
                createTier(name, color, fontSize);
                modal.remove();
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
    });

    // Add new item (show modal)
    addItemButton.addEventListener('click', () => {
        addItemModal.style.display = 'flex';
        addItemForm.reset();
        imagePreview.innerHTML = '';
        itemNameInput.focus();
    });

    // Cancel add item
    cancelAddItem.addEventListener('click', () => {
        addItemModal.style.display = 'none';
    });

    // Image preview
    itemImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            imagePreview.innerHTML = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.onload = function() {
                // Only rescale if larger than 500x500
                let w = img.width, h = img.height;
                const maxDim = 500;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round(h * maxDim / w);
                        w = maxDim;
                    } else {
                        w = Math.round(w * maxDim / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                imagePreview.innerHTML = '';
                const previewImg = document.createElement('img');
                previewImg.src = canvas.toDataURL('image/png');
                previewImg.width = w;
                previewImg.height = h;
                imagePreview.appendChild(previewImg);
            };
        };
        reader.readAsDataURL(file);
    });

    // Handle add item form submit
    addItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = itemNameInput.value.trim();
        const file = itemImageInput.files[0];
        if (!name || !file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            // Only rescale if larger than 500x500
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.onload = function() {
                let w = img.width, h = img.height;
                const maxDim = 500;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round(h * maxDim / w);
                        w = maxDim;
                    } else {
                        w = Math.round(w * maxDim / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/png');
                createItem(name, dataUrl, w, h);
                addItemModal.style.display = 'none';
            };
        };
        reader.readAsDataURL(file);
    });

    // Enable pasting images into the Add Item modal
    addItemModal.addEventListener('paste', function(e) {
        if (addItemModal.style.display !== 'flex') return;
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const file = new File([blob], 'clipboard.png', { type: blob.type });
                // Set the file input's files property
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                itemImageInput.files = dataTransfer.files;
                // Trigger the change event to update the preview
                const event = new Event('change', { bubbles: true });
                itemImageInput.dispatchEvent(event);
                break;
            }
        }
    });

    function createTier(name, color = '#FF4D4D', fontSize = 24) {
        const tierRow = document.createElement('div');
        tierRow.className = `tier-row`;
        tierRow.setAttribute('data-tier', name);
        tierRow.setAttribute('data-color', color);
        tierRow.setAttribute('data-font-size', fontSize);
        tierRow.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

        const tierLabel = document.createElement('div');
        tierLabel.className = 'tier-label';
        tierLabel.textContent = name;
        tierLabel.style.userSelect = 'none';
        tierLabel.style.cursor = 'grab';
        tierLabel.style.backgroundColor = color;
        tierLabel.style.fontSize = fontSize + 'px';

        const tierContent = document.createElement('div');
        tierContent.className = 'tier-content';

        tierRow.appendChild(tierLabel);
        tierRow.appendChild(tierContent);
        tierList.appendChild(tierRow);

        tierLabel.addEventListener('pointerdown', e => startTierDrag(e, tierRow));
        setupDropZone(tierContent);
        // Observe for item changes
        observeTierContent(tierContent);
        updateItemPoolCounter();
        return tierRow;
    }

    // name: string, imageDataUrl: string, w: number, h: number
    function createItem(name, imageDataUrl, w, h) {
        const item = document.createElement('div');
        item.className = 'tier-item';
        item.style.userSelect = 'none';
        item.style.cursor = 'grab';
        item.setAttribute('data-name', name);
        item.setAttribute('data-img', imageDataUrl);

        // Image
        const img = document.createElement('img');
        img.src = imageDataUrl;
        item.appendChild(img);

        // Name
        const label = document.createElement('div');
        label.textContent = name;
        label.className = 'item-label';
        item.appendChild(label);

        // Setup custom drag for item
        item.addEventListener('pointerdown', e => startItemDrag(e, item));

        itemPool.appendChild(item);
        item.classList.add('drop-pulse');
        setTimeout(() => item.classList.remove('drop-pulse'), 300);
        return item;
    }

    // --- Custom Drag Logic ---
    function startItemDrag(e, item) {
        e.preventDefault();
        if (dragData) return;
        dragType = 'item';
        dragData = item;
        dragOrigin = item.parentElement;
        createDragPreview(item, e.clientX, e.clientY);
        item.classList.add('ghost');
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function startTierDrag(e, tierRow) {
        e.preventDefault();
        if (dragData) return;
        dragType = 'tier';
        dragData = tierRow;
        dragOrigin = tierRow.parentElement;

        // Remove transition during drag
        dragData.style.transition = 'none';
        
        const rect = tierRow.getBoundingClientRect();
        tierInitialX = rect.left;

        dragPreview = tierRow.cloneNode(true);
        dragPreview.style.position = 'fixed';
        dragPreview.style.pointerEvents = 'none';
        dragPreview.style.zIndex = 9999;
        dragPreview.style.width = `${tierRow.offsetWidth}px`;
        dragPreview.style.transform = 'scale(1.02)';
        dragPreview.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        dragPreview.style.opacity = '0.95';
        dragPreview.style.left = `${tierInitialX}px`;
        dragPreview.style.top = `${e.clientY - tierRow.offsetHeight / 2}px`;
        dragPreview.classList.add('dragging');
        document.body.appendChild(dragPreview);

        // Make original semi-transparent
        tierRow.style.opacity = '0.4';

        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function createDragPreview(element, x, y, isTier = false) {
        dragPreview = element.cloneNode(true);
        dragPreview.style.position = 'fixed';
        dragPreview.style.pointerEvents = 'none';
        dragPreview.style.zIndex = 9999;
        dragPreview.style.transform = 'scale(1.08)';
        dragPreview.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        dragPreview.classList.add('dragging');
        document.body.appendChild(dragPreview);

        // Set initial positions
        if (isTier) {
            lerpX = targetX = tierInitialX;
            lerpY = targetY = y - element.offsetHeight / 2;
        } else {
            lerpX = targetX = x - element.offsetWidth / 2;
            lerpY = targetY = y - element.offsetHeight / 2;
        }

        // Apply initial position
        dragPreview.style.left = `${Math.round(lerpX)}px`;
        dragPreview.style.top = `${Math.round(lerpY)}px`;
        dragPreview.style.width = `${element.offsetWidth}px`;
        dragPreview.style.height = `${element.offsetHeight}px`;
        
        dragPreview.style.cursor = 'grabbing';
        
        animateDragPreview();
    }

    function animateDragPreview() {
        if (dragType === 'tier') {
            // Instant X position lock for tiers
            lerpX = tierInitialX;
            
            // Fast direct lerp for Y
            const diffY = targetY - lerpY;
            lerpY += diffY * lerpSpeedTier;
            
            // Snap if very close
            if (Math.abs(diffY) < 1) {
                lerpY = targetY;
            }
        } else {
            // Fast direct lerp for items
            const diffX = targetX - lerpX;
            const diffY = targetY - lerpY;
            
            lerpX += diffX * lerpSpeedItem;
            lerpY += diffY * lerpSpeedItem;
            
            // Snap if very close
            if (Math.abs(diffX) < 1) lerpX = targetX;
            if (Math.abs(diffY) < 1) lerpY = targetY;
        }

        // Apply position with rounding to avoid sub-pixel rendering
        dragPreview.style.left = `${Math.round(lerpX)}px`;
        dragPreview.style.top = `${Math.round(lerpY)}px`;
        
        animationFrame = requestAnimationFrame(animateDragPreview);
    }

    function onPointerMove(e) {
        if (!dragPreview) return;
        
        isMoving = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        if (dragType === 'tier') {
            // Direct positioning for tier preview
            dragPreview.style.left = `${tierInitialX}px`;
            dragPreview.style.top = `${e.clientY - dragPreview.offsetHeight / 2}px`;

            const rows = Array.from(tierList.children);
            let closest = null, closestDist = Infinity;
            rows.forEach(row => {
                if (row === dragData) return;
                const box = row.getBoundingClientRect();
                const dist = Math.abs(e.clientY - (box.top + box.height / 2));
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = row;
                }
            });

            if (closest && Math.abs(e.clientY - (closest.getBoundingClientRect().top + closest.offsetHeight / 2)) < dragData.offsetHeight / 2) {
                // Enable transitions for other rows
                rows.forEach(row => {
                    if (row !== dragData) {
                        row.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                    }
                });

                if (e.clientY < closest.getBoundingClientRect().top + closest.offsetHeight / 2) {
                    tierList.insertBefore(dragData, closest);
                } else {
                    tierList.insertBefore(dragData, closest.nextSibling);
                }
            }
        } else if (dragType === 'item') {
            targetX = e.clientX - dragPreview.offsetWidth / 2;
            targetY = e.clientY - dragPreview.offsetHeight / 2;
            // Find drop zone under pointer
            const dropZones = document.querySelectorAll('.tier-content, #itemPool');
            let found = false;
            dropZones.forEach(zone => {
                const rect = zone.getBoundingClientRect();
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    found = true;
                    zone.classList.add('dragging-over');
                    // Insert at closest position (fix for multi-row)
                    const items = Array.from(zone.children).filter(child => child !== dragData);
                    let closest = null, closestDist = Infinity;
                    items.forEach(child => {
                        const box = child.getBoundingClientRect();
                        // Use both X and Y distance for multi-row
                        const dx = e.clientX - (box.left + box.width / 2);
                        const dy = e.clientY - (box.top + box.height / 2);
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closest = child;
                        }
                    });
                    if (closest) {
                        // Insert before or after based on pointer position
                        const box = closest.getBoundingClientRect();
                        if (e.clientY < box.top + box.height / 2 || (Math.abs(e.clientY - (box.top + box.height / 2)) < box.height / 2 && e.clientX < box.left + box.width / 2)) {
                            zone.insertBefore(dragData, closest);
                        } else {
                            zone.insertBefore(dragData, closest.nextSibling);
                        }
                    } else {
                        zone.appendChild(dragData);
                    }
                } else {
                    zone.classList.remove('dragging-over');
                }
            });
        }
    }

    function onPointerUp(e) {
        if (!dragData) return;
        
        if (dragType === 'tier') {
            // Restore transition and opacity
            dragData.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
            dragData.style.opacity = '1';
            
            // Final animation for other rows
            const rows = Array.from(tierList.children);
            rows.forEach(row => {
                if (row !== dragData) {
                    row.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                }
            });
        } else if (dragType === 'item') {
            // Remove any ghost styling from the item
            dragData.classList.remove('ghost');
            dragData.style.opacity = '1';
        }

        if (dragPreview) {
            dragPreview.remove();
            dragPreview = null;
        }
        if (animationFrame) cancelAnimationFrame(animationFrame);
        
        document.body.style.userSelect = '';
        document.querySelectorAll('.dragging-over').forEach(el => el.classList.remove('dragging-over'));
        
        dragData = null;
        dragType = null;
        dragOrigin = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    }

    function setupDropZone(dropZone) {
        // No-op: handled by custom drag logic
    }

    // Setup item pool as a drop zone
    setupDropZone(itemPool);

    // Save/Load functionality
    saveTierlistButton.addEventListener('click', saveTierlist);
    loadTierlistButton.addEventListener('click', () => loadTierlistInput.click());
    loadTierlistInput.addEventListener('change', loadTierlist);
    saveScreenshotButton.addEventListener('click', saveScreenshot);

    function sanitizeFileName(name) {
        return name.replace(/[^a-z0-9\-\_\(\)\[\]\s]/gi, '').replace(/\s+/g, '_').substring(0, 64) || 'tierlist';
    }

    async function saveTierlist() {
        // Collect all items from both tiers and pool into poolItems
        const poolItems = [];
        // Items from pool
        Array.from(itemPool.children).forEach(item => {
            poolItems.push({
                name: item.getAttribute('data-name'),
                image: item.getAttribute('data-img')
            });
        });
        // Items from tiers
        Array.from(tierList.children).forEach(tier => {
            Array.from(tier.querySelector('.tier-content').children).forEach(item => {
                poolItems.push({
                    name: item.getAttribute('data-name'),
                    image: item.getAttribute('data-img')
                });
            });
        });
        // Save tiers as empty
        const tiers = Array.from(tierList.children).map(tier => ({
            name: tier.getAttribute('data-tier'),
            color: tier.getAttribute('data-color'),
            fontSize: parseInt(tier.getAttribute('data-font-size'), 10) || 24,
            items: []
        }));
        // Compress images to PNG (preserve alpha)
        const compressImage = async (dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width;
                    let h = img.height;
                    const maxSize = 500;
                    if (w > maxSize || h > maxSize) {
                        if (w > h) {
                            h = Math.round(h * maxSize / w);
                            w = maxSize;
                        } else {
                            w = Math.round(w * maxSize / h);
                            h = maxSize;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = dataUrl;
            });
        };
        // Compress all images from pool
        const compressPromises = poolItems.map(item =>
            compressImage(item.image).then(compressed => item.image = compressed)
        );
        await Promise.all(compressPromises);
        // Create and save the file
        const data = {
            title: currentTierlistTitle,
            creator: currentCreator,
            tiers,
            poolItems,
            version: '1.1'
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitizeFileName(currentTierlistTitle) + '.btier';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function loadTierlist(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            // Clear current tierlist
            tierList.innerHTML = '';
            itemPool.innerHTML = '';
            // If version is missing or < 1.1, load all items into pool
            if (!data.version || data.version < '1.1') {
                // Gather all items from tiers and pool
                const allItems = [];
                if (data.tiers) {
                    data.tiers.forEach(tier => {
                        if (tier.items) allItems.push(...tier.items);
                    });
                }
                if (data.poolItems) allItems.push(...data.poolItems);
                allItems.forEach(item => {
                    const itemElement = createItemFromData(item);
                    itemPool.appendChild(itemElement);
                });
                // Create tiers (empty)
                if (data.tiers) {
                    data.tiers.forEach(tier => {
                        createTier(tier.name, tier.color || '#FF4D4D', tier.fontSize || 24);
                    });
                }
            } else {
                // Create tiers and add their items (should be empty in v1.1+)
                data.tiers.forEach(tier => {
                    const tierRow = createTier(tier.name, tier.color || '#FF4D4D', tier.fontSize || 24);
                    const tierContent = tierRow.querySelector('.tier-content');
                    // Add items to tier (should be empty)
                    if (tier.items) {
                        tier.items.forEach(item => {
                            const itemElement = createItemFromData(item);
                            tierContent.appendChild(itemElement);
                        });
                    }
                    // Observe for item changes
                    observeTierContent(tierContent);
                });
                // Add items to pool
                data.poolItems.forEach(item => {
                    const itemElement = createItemFromData(item);
                    itemPool.appendChild(itemElement);
                });
            }
            updateItemPoolCounter();
            if (data.title) setTierlistTitle(data.title);
            if (data.creator) setCreator(data.creator);
        } catch (error) {
            console.error('Error loading tierlist:', error);
            alert('Error loading tierlist file. Please make sure it\'s a valid .btier file.');
        }
        // Clear the input so the same file can be loaded again
        e.target.value = '';
    }

    function createItemFromData(itemData) {
        const item = document.createElement('div');
        item.className = 'tier-item';
        item.style.userSelect = 'none';
        item.style.cursor = 'grab';
        item.setAttribute('data-name', itemData.name);
        item.setAttribute('data-img', itemData.image);

        const img = document.createElement('img');
        img.src = itemData.image;
        item.appendChild(img);

        const label = document.createElement('div');
        label.textContent = itemData.name;
        label.className = 'item-label';
        item.appendChild(label);

        item.addEventListener('pointerdown', e => startItemDrag(e, item));
        return item;
    }

    async function saveScreenshot() {
        // Create a canvas with padding
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const padding = 20;
        const tierListEl = document.getElementById('tierList');
        // Calculate required canvas height by simulating wrapping
        const tiers = Array.from(tierListEl.children);
        const labelWidth = 100;
        const itemBoxSize = 88;
        const itemBoxGap = 12;
        let totalHeight = padding;
        const tierHeights = [];
        for (const tier of tiers) {
            const items = Array.from(tier.querySelector('.tier-content').children);
            const tierContentWidth = tier.querySelector('.tier-content').clientWidth || (tierListEl.clientWidth - labelWidth - itemBoxGap);
            const itemsPerRow = Math.max(1, Math.floor((tierContentWidth) / (itemBoxSize + itemBoxGap)));
            const numRows = Math.ceil(items.length / itemsPerRow);
            const tierHeight = Math.max(itemBoxSize + 12, numRows * (itemBoxSize + itemBoxGap) + 12);
            tierHeights.push(tierHeight);
            totalHeight += tierHeight + 12;
        }
        totalHeight += padding;
        canvas.width = tierListEl.clientWidth + (padding * 2);
        canvas.height = totalHeight;
        // Fill background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Use Nunito font
        ctx.font = 'bold 24px Nunito, Arial, sans-serif';
        ctx.textBaseline = 'middle';
        // Function to draw rounded rectangle
        function roundRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }
        // Draw each tier
        let currentY = padding;
        const labelBoxHeight = 22;
        for (let t = 0; t < tiers.length; ++t) {
            const tier = tiers[t];
            const tierHeight = tierHeights[t];
            const tierColor = tier.getAttribute('data-color') || '#FF4D4D';
            const tierFontSize = parseInt(tier.getAttribute('data-font-size'), 10) || 24;
            // Draw tier background
            ctx.fillStyle = '#363636';
            roundRect(ctx, padding, currentY, canvas.width - padding * 2, tierHeight, 8);
            ctx.fill();
            // Draw tier label
            ctx.fillStyle = tierColor;
            roundRect(ctx, padding, currentY, labelWidth, tierHeight, 8);
            ctx.fill();
            // Draw tier label text
            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${tierFontSize}px Nunito, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tier.getAttribute('data-tier'), padding + labelWidth / 2, currentY + tierHeight / 2);
            ctx.restore();
            // Draw items, wrapping to rows
            const items = Array.from(tier.querySelector('.tier-content').children);
            const tierContentWidth = tier.querySelector('.tier-content').clientWidth || (tierListEl.clientWidth - labelWidth - itemBoxGap);
            const itemsPerRow = Math.max(1, Math.floor((tierContentWidth) / (itemBoxSize + itemBoxGap)));
            for (let row = 0; row < Math.ceil(items.length / itemsPerRow); ++row) {
                for (let col = 0; col < itemsPerRow; ++col) {
                    const idx = row * itemsPerRow + col;
                    if (idx >= items.length) break;
                    const item = items[idx];
                    const itemX = padding + labelWidth + itemBoxGap + col * (itemBoxSize + itemBoxGap);
                    const itemY = currentY + 12 + row * (itemBoxSize + itemBoxGap);
                    // Draw item background
                    ctx.fillStyle = '#2d2d2d';
                    roundRect(ctx, itemX, itemY, itemBoxSize, itemBoxSize, 8);
                    ctx.fill();
                    // Draw item border
                    ctx.strokeStyle = '#4d4d4d';
                    ctx.lineWidth = 2;
                    roundRect(ctx, itemX, itemY, itemBoxSize, itemBoxSize, 8);
                    ctx.stroke();
                    // Draw the image
                    const img = item.querySelector('img');
                    if (img) {
                        const imgWidth = img.naturalWidth || img.width;
                        const imgHeight = img.naturalHeight || img.height;
                        const scale = Math.min((itemBoxSize * 0.92) / imgWidth, (itemBoxSize * 0.76) / imgHeight);
                        const scaledWidth = imgWidth * scale;
                        const scaledHeight = imgHeight * scale;
                        const imgX = itemX + (itemBoxSize - scaledWidth) / 2;
                        const imgY = itemY + (itemBoxSize - labelBoxHeight - scaledHeight) / 2;
                        ctx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight);
                    }
                    // Draw item label inside the frame at the bottom
                    ctx.save();
                    ctx.fillStyle = 'rgba(30,30,30,0.85)';
                    ctx.fillRect(itemX, itemY + itemBoxSize - labelBoxHeight, itemBoxSize, labelBoxHeight);
                    ctx.font = 'bold 16px Nunito, Arial, sans-serif';
                    ctx.fillStyle = '#e0e0e0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = item.getAttribute('data-name');
                    ctx.fillText(label, itemX + itemBoxSize / 2, itemY + itemBoxSize - labelBoxHeight / 2 + 1);
                    ctx.restore();
                }
            }
            currentY += tierHeight + 12;
        }
        // Save the canvas as PNG
        const link = document.createElement('a');
        link.download = 'tierlist.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Fullscreen popup for item images
    function showImagePopup(src, labelText = null) {
        let popup = document.getElementById('imagePopupModal');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'imagePopupModal';
            popup.style.position = 'fixed';
            popup.style.top = '0';
            popup.style.left = '0';
            popup.style.width = '100vw';
            popup.style.height = '100vh';
            popup.style.background = 'rgba(0,0,0,0.95)';
            popup.style.display = 'flex';
            popup.style.flexDirection = 'column';
            popup.style.alignItems = 'center';
            popup.style.justifyContent = 'center';
            popup.style.zIndex = '10001';
            popup.innerHTML = '<img style="border-radius:16px; box-shadow:0 8px 32px #000;"><div id="popupLabel" style="margin-top:32px; color:#fff; font-family:Nunito,Arial,sans-serif; font-size:2.2em; font-weight:bold; text-align:center; max-width:90vw; word-break:break-word;"></div>';
            document.body.appendChild(popup);
            popup.addEventListener('click', () => popup.style.display = 'none');
            window.addEventListener('keydown', function escListener(e) {
                if (e.key === 'Escape') popup.style.display = 'none';
            });
        }
        const img = popup.querySelector('img');
        const labelDiv = popup.querySelector('#popupLabel');
        img.onload = function() {
            // 3x natural size, but clamp to viewport
            let w = img.naturalWidth * 3;
            let h = img.naturalHeight * 3;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let scale = Math.min(vw / w, (vh - 120) / h, 1); // leave space for label
            img.style.width = (w * scale) + 'px';
            img.style.height = (h * scale) + 'px';
            img.style.maxWidth = '';
            img.style.maxHeight = '';
        };
        img.src = src;
        if (labelText) {
            labelDiv.textContent = labelText;
            labelDiv.style.display = '';
        } else {
            labelDiv.textContent = '';
            labelDiv.style.display = 'none';
        }
        popup.style.display = 'flex';
    }

    // Ensure counter is visible on load
    itemPoolCounter.style.display = '';

    // Helper to observe a new tier-content
    function observeTierContent(tc) {
        observer.observe(tc, { childList: true });
        updateItemPoolCounter();
    }

    // Tab switching logic
    const tabCreate = document.getElementById('tab-create');
    const tabExplore = document.getElementById('tab-explore');
    const tabContentCreate = document.getElementById('tab-content-create');
    const tabContentExplore = document.getElementById('tab-content-explore');

    function showTab(tab) {
        if (tab === 'create') {
            tabCreate.classList.add('active');
            tabExplore.classList.remove('active');
            tabContentCreate.style.display = '';
            tabContentExplore.style.display = 'none';
        } else {
            tabCreate.classList.remove('active');
            tabExplore.classList.add('active');
            tabContentCreate.style.display = 'none';
            tabContentExplore.style.display = '';
            loadExploreTierlists();
        }
    }

    tabCreate.addEventListener('click', () => showTab('create'));
    tabExplore.addEventListener('click', () => showTab('explore'));

    // Explore tab logic
    async function loadExploreTierlists() {
        const grid = document.getElementById('explore-grid');
        const searchInput = document.getElementById('explore-search');
        grid.innerHTML = '<div style="opacity:0.7;">Loading tierlists...</div>';
        let filenames = [];
        try {
            const res = await fetch('explore/index.json');
            filenames = await res.json(); // ["pokemon-gen1.btier", ...]
        } catch (e) {
            grid.innerHTML = '<div style="color:#e57373;">Failed to load tierlists.</div>';
            return;
        }
        // Get file sizes using HEAD requests
        async function getFileSize(filename) {
            try {
                const res = await fetch(`explore/${filename}`, { method: 'HEAD' });
                const size = res.headers.get('content-length');
                return { filename, size: size ? parseInt(size, 10) : 0 };
            } catch {
                return { filename, size: 0 };
            }
        }
        let fileMeta = await Promise.all(filenames.map(getFileSize));
        // Helper to load and parse a .btier file
        async function loadTierlistFile(filename) {
            try {
                const dataRes = await fetch(`explore/${filename}`);
                const data = await dataRes.json();
                return { ...data, filename };
            } catch {
                return null;
            }
        }
        // Progressive loading logic
        let tierlists = [];
        let loading = false;
        let lastSearch = '';
        async function progressiveLoad(filter = '') {
            grid.innerHTML = '';
            lastSearch = filter;
            // Prioritize search matches
            const f = filter.toLowerCase();
            let matches = [], rest = [];
            for (const meta of fileMeta) {
                if (!f) {
                    rest.push(meta);
                } else {
                    // Try to use cached title/creator if already loaded
                    const cached = tierlists.find(t => t && t.filename === meta.filename);
                    if (cached && ((cached.title && cached.title.toLowerCase().includes(f)) || (cached.creator && cached.creator.toLowerCase().includes(f)))) {
                        matches.push(meta);
                    } else {
                        rest.push(meta);
                    }
                }
            }
            // If searching, load matches first, then rest
            let sortedMeta = [];
            if (f) {
                // Load all files to check for matches
                let allLoaded = await Promise.all(fileMeta.map(async meta => {
                    const t = tierlists.find(t => t && t.filename === meta.filename) || await loadTierlistFile(meta.filename);
                    if (t && ((t.title && t.title.toLowerCase().includes(f)) || (t.creator && t.creator.toLowerCase().includes(f)))) {
                        return { ...meta, match: true, data: t };
                    } else {
                        return { ...meta, match: false, data: t };
                    }
                }));
                // Sort: matches first (by size), then rest (by size)
                let matchList = allLoaded.filter(m => m.match).sort((a, b) => a.size - b.size);
                let restList = allLoaded.filter(m => !m.match).sort((a, b) => a.size - b.size);
                sortedMeta = [...matchList, ...restList];
            } else {
                sortedMeta = fileMeta.slice().sort((a, b) => a.size - b.size).map(m => ({ ...m, match: false }));
            }
            // Progressive rendering
            tierlists = [];
            let i = 0;
            async function loadNext() {
                if (i >= sortedMeta.length || lastSearch !== filter) return;
                const meta = sortedMeta[i++];
                let t = meta.data;
                if (!t) t = await loadTierlistFile(meta.filename);
                if (t) tierlists.push(t);
                renderGrid(tierlists, filter);
                setTimeout(loadNext, 80); // Stagger loading for smoothness
            }
            loadNext();
        }
        function renderGrid(tierlists, filter = '') {
            grid.innerHTML = '';
            let filtered = tierlists;
            if (filter) {
                const f = filter.toLowerCase();
                filtered = tierlists.filter(t =>
                    (t.title && t.title.toLowerCase().includes(f)) ||
                    (t.creator && t.creator.toLowerCase().includes(f))
                );
            }
            if (!filtered.length) {
                grid.innerHTML = '<div style="opacity:0.7;">No tierlists found.</div>';
                return;
            }
            filtered.forEach(tierlist => {
                const card = document.createElement('div');
                card.className = 'explore-card';
                card.style.background = '#232323';
                card.style.borderRadius = '12px';
                card.style.boxShadow = '0 2px 12px #0006';
                card.style.padding = '18px 14px 14px 14px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.cursor = 'pointer';
                card.style.transition = 'transform 0.15s, box-shadow 0.15s';
                card.style.position = 'relative';
                card.style.overflow = 'hidden';
                card.onmouseenter = () => { card.style.transform = 'scale(1.03)'; card.style.boxShadow = '0 4px 24px #000a'; };
                card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = '0 2px 12px #0006'; };
                // Generate preview image
                const preview = document.createElement('div');
                preview.style.width = '100%';
                preview.style.height = '140px';
                preview.style.background = '#181818';
                preview.style.borderRadius = '8px';
                preview.style.display = 'grid';
                preview.style.gridTemplateColumns = 'repeat(3, 1fr)';
                preview.style.gridTemplateRows = 'repeat(3, 1fr)';
                preview.style.gap = '4px';
                preview.style.marginBottom = '12px';
                preview.style.overflow = 'hidden';
                const items = [];
                tierlist.tiers && tierlist.tiers.forEach(tier => {
                    if (tier.items) items.push(...tier.items);
                });
                tierlist.poolItems && items.push(...tierlist.poolItems);
                for (let i = 0; i < Math.min(9, items.length); ++i) {
                    const it = items[i];
                    const img = document.createElement('img');
                    img.src = it.image;
                    img.alt = it.name;
                    img.title = it.name;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    img.style.background = '#222';
                    img.style.borderRadius = '6px';
                    preview.appendChild(img);
                }
                card.appendChild(preview);
                // Title
                const title = document.createElement('div');
                title.textContent = tierlist.title || tierlist.filename.replace(/\.btier$/, '');
                title.style.fontWeight = 'bold';
                title.style.fontSize = '1.15em';
                title.style.marginBottom = '2px';
                title.style.textAlign = 'center';
                card.appendChild(title);
                // Creator
                if (tierlist.creator) {
                    const creator = document.createElement('div');
                    creator.textContent = '@' + tierlist.creator.replace(/^@/, '');
                    creator.style.fontSize = '0.92em';
                    creator.style.color = '#b0b0b0';
                    creator.style.opacity = '0.7';
                    creator.style.marginBottom = '2px';
                    creator.style.textAlign = 'center';
                    card.appendChild(creator);
                }
                card.addEventListener('click', () => {
                    showTab('create');
                    loadTierlistFromData(tierlist);
                    setTierlistTitle(tierlist.title || tierlist.filename.replace(/\.btier$/, ''));
                    setCreator(tierlist.creator || '');
                });
                grid.appendChild(card);
            });
        }
        // Initial load
        progressiveLoad();
        searchInput.oninput = e => progressiveLoad(e.target.value);
    }

    function loadTierlistFromData(data) {
        // Clear current tierlist
        tierList.innerHTML = '';
        itemPool.innerHTML = '';
        // For compatibility, always put all items in the pool (from both tiers and poolItems)
        const allItems = [];
        if (data.tiers) {
            data.tiers.forEach(tier => {
                if (tier.items) allItems.push(...tier.items);
            });
        }
        if (data.poolItems) allItems.push(...data.poolItems);
        allItems.forEach(item => {
            const itemElement = createItemFromData(item);
            itemPool.appendChild(itemElement);
        });
        // Create tiers (empty)
        if (data.tiers) {
            data.tiers.forEach(tier => {
                createTier(tier.name, tier.color || '#FF4D4D', tier.fontSize || 24);
            });
        }
        updateItemPoolCounter();
        if (data.title) setTierlistTitle(data.title);
        if (data.creator) setCreator(data.creator);
    }

    // Creator logic
    const creatorText = document.getElementById('creatorText');
    const editCreatorBtn = document.getElementById('editCreatorBtn');
    function setCreator(name) {
        creatorText.textContent = name ? '@' + name.replace(/^@/, '') : '@';
        currentCreator = name ? name.replace(/^@/, '') : '';
    }
    let currentCreator = '';
    creatorText.addEventListener('click', () => {
        const newCreator = prompt('Enter creator name (without @):', currentCreator);
        if (newCreator !== null) setCreator(newCreator);
    });
    if (editCreatorBtn) {
        editCreatorBtn.addEventListener('click', () => {
            const newCreator = prompt('Enter creator name (without @):', currentCreator);
            if (newCreator !== null) setCreator(newCreator);
        });
    }
    setCreator('');
}); 