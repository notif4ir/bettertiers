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

    async function saveTierlist() {
        // Collect tierlist data including items in each tier
        const tiers = Array.from(tierList.children).map(tier => ({
            name: tier.getAttribute('data-tier'),
            color: tier.getAttribute('data-color'),
            fontSize: parseInt(tier.getAttribute('data-font-size'), 10) || 24,
            items: Array.from(tier.querySelector('.tier-content').children).map(item => ({
                name: item.getAttribute('data-name'),
                image: item.getAttribute('data-img')
            }))
        }));

        // Collect item pool data
        const poolItems = Array.from(itemPool.children).map(item => ({
            name: item.getAttribute('data-name'),
            image: item.getAttribute('data-img')
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

        // Compress all images from both tiers and pool
        const compressPromises = [];
        tiers.forEach(tier => {
            tier.items.forEach(item => {
                compressPromises.push(
                    compressImage(item.image).then(compressed => item.image = compressed)
                );
            });
        });
        poolItems.forEach(item => {
            compressPromises.push(
                compressImage(item.image).then(compressed => item.image = compressed)
            );
        });
        
        await Promise.all(compressPromises);

        // Create and save the file
        const data = {
            tiers,
            poolItems,
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tierlist.btier';
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

            // Create tiers and add their items
            data.tiers.forEach(tier => {
                const tierRow = createTier(tier.name, tier.color || '#FF4D4D', tier.fontSize || 24);
                const tierContent = tierRow.querySelector('.tier-content');
                
                // Add items to tier
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
            updateItemPoolCounter();

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

        // Get the tierlist element
        const tierListEl = document.getElementById('tierList');
        const rect = tierListEl.getBoundingClientRect();

        // Set canvas size to match tierlist plus padding
        canvas.width = rect.width + (padding * 2);
        canvas.height = rect.height + (padding * 2);

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
        const tiers = Array.from(tierListEl.children);
        let currentY = padding;
        const itemBoxSize = 88;
        const itemBoxGap = 12;
        const labelHeight = 24; // for the label at the bottom
        const labelFont = 'bold 16px Nunito, Arial, sans-serif';
        const labelBg = 'rgba(30,30,30,0.85)';
        const labelPad = 4;
        const labelTextColor = '#e0e0e0';
        const labelLineHeight = 1.1;
        const labelBoxHeight = 22;
        const labelFontSize = 16;
        for (const tier of tiers) {
            const tierHeight = tier.offsetHeight;
            const labelWidth = 100; // Fixed width of tier labels
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

            // Draw items
            const items = Array.from(tier.querySelector('.tier-content').children);
            let itemX = padding + labelWidth + itemBoxGap;
            const itemY = currentY + (tierHeight - itemBoxSize) / 2;

            for (const item of items) {
                const img = item.querySelector('img');
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
                ctx.fillStyle = labelBg;
                ctx.fillRect(itemX, itemY + itemBoxSize - labelBoxHeight, itemBoxSize, labelBoxHeight);
                ctx.font = labelFont;
                ctx.fillStyle = labelTextColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = item.getAttribute('data-name');
                ctx.fillText(label, itemX + itemBoxSize / 2, itemY + itemBoxSize - labelBoxHeight / 2 + 1);
                ctx.restore();

                itemX += itemBoxSize + itemBoxGap;
            }

            currentY += tierHeight + 12; // Add gap between tiers
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
}); 