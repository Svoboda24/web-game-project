class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.coins = 0;
    this.experience = 0;
    this.level = 1;
    this.currentCarId = 'c1';
    this.canOpenCase = true;
    this.pendingWinner = null;
    this.currentGaragePage = 1;
    this.carsPerPage = 60;
    this.caseConfigs = {
      common: { price: 1, rates: { common: 50, rare: 30, epic: 15, legendary: 4, special: 1 } },
      elite: { price: 3, rates: { rare: 45, epic: 35, legendary: 15, special: 4, mythical: 1 } },
      underground: { price: 5, rates: { epic: 40, legendary: 35, special: 15, mythical: 10 } }
    };
  }

  init() {
    this.carsCollection = JSON.parse(JSON.stringify(CARS_DATA));
    this.loadGame();
    console.log('📦 Инициализация. Всего машин:', this.carsCollection.length);
  }

  preload() {
    this.carsCollection.forEach(car => {
      if (car.image) {
        this.load.image(car.id, car.image);
      }
    });
  }

  create() {
    const { width, height } = this.scale;
    
    this.add.graphics()
      .fillStyle(0x0a0a0f, 1)
      .fillRect(0, 0, width, height);
    
    this.add.graphics()
      .lineStyle(2, 0x3b82f6, 0.2)
      .strokeCircle(width / 2, height / 2, 120);
    
    const currentCar = this.carsCollection.find(c => c.id === this.currentCarId);
    
    if (currentCar && currentCar.image) {
      this.carSprite = this.add.sprite(width / 2, height / 2, currentCar.id)
        .setInteractive({ useHandCursor: true })
        .setDisplaySize(200, 200);
    } else {
      this.carSprite = this.add.text(width / 2, height / 2, '🚗', { 
        fontSize: '120px',
        fontFamily: 'Arial',
        color: '#ffffff'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    }

    this.carSprite.on('pointerdown', () => {
      this.coins++;
      this.addExperience(1);
      
      this.tweens.add({ 
        targets: this.carSprite, 
        scale: 1.3, 
        duration: 100, 
        yoyo: true,
        ease: 'Bounce'
      });
      
      this.createCoinParticles(width / 2, height / 2);
      this.updateUI();
      this.saveGame();
    });

    this.setupTabs();
    this.setupCaseButtons();
    this.setupGaragePagination();
    this.updateUI();
    this.updateGarage();
  }

  createCoinParticles(x, y) {
    for (let i = 0; i < 5; i++) {
      const particle = this.add.text(x, y, '🪙', { fontSize: '20px' });
      this.tweens.add({
        targets: particle,
        x: x + (Math.random() - 0.5) * 100,
        y: y - 50 - Math.random() * 50,
        alpha: 0,
        scale: 0.5,
        duration: 800,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  setupTabs() {
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-button, .tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        
        if(btn.dataset.tab === 'garage') {
          this.currentGaragePage = 1;
          this.updateGarage();
          this.updatePaginationControls();
          setTimeout(() => {
            const container = document.querySelector('.garage-grid-container');
            if (container) container.scrollTop = 0;
          }, 50);
        } else if (btn.dataset.tab === 'store') {
          setTimeout(() => {
            const storeTab = document.getElementById('store-tab');
            if (storeTab) storeTab.scrollLeft = 0;
          }, 50);
        }
      };
    });
  }

  setupGaragePagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.currentGaragePage > 1) {
          this.currentGaragePage--;
          this.updateGarage();
          this.updatePaginationControls();
        }
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = () => {
        const ownedCars = this.carsCollection.filter(car => car.owned);
        const totalPages = Math.ceil(ownedCars.length / this.carsPerPage);
        if (this.currentGaragePage < totalPages) {
          this.currentGaragePage++;
          this.updateGarage();
          this.updatePaginationControls();
        }
      };
    }
  }

  updatePaginationControls() {
    const ownedCars = this.carsCollection.filter(car => car.owned);
    const totalPages = Math.max(1, Math.ceil(ownedCars.length / this.carsPerPage));
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (prevBtn) prevBtn.disabled = this.currentGaragePage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentGaragePage >= totalPages;
    if (pageInfo) pageInfo.innerText = `Страница ${this.currentGaragePage} / ${totalPages}`;
  }

  setupCaseButtons() {
    document.querySelectorAll('.case-button').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.onclick = () => this.startRoulette(newBtn.dataset.caseType);
    });
  }

  startRoulette(type) {
    const config = this.caseConfigs[type];
    if (this.coins < config.price || !this.canOpenCase) return;

    this.coins -= config.price;
    this.canOpenCase = false;
    this.updateUI();

    // ВЫБИРАЕМ ПОБЕДИТЕЛЯ
    this.pendingWinner = this.selectWinner(config.rates);
    console.log('🎰 КЕЙС:', type);
    console.log('🎰 ПОБЕДИТЕЛЬ ВЫБРАН:', this.pendingWinner.name, 'ID:', this.pendingWinner.id, 'Редкость:', this.pendingWinner.rarity);

    const overlay = document.getElementById('case-overlay');
    const tape = document.getElementById('roulette-tape');
    overlay.style.display = 'flex';
    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0)';
    tape.innerHTML = '';

    const itemsCount = 60;
    const winningPosition = 30;
    
    for (let i = 0; i < itemsCount; i++) {
      let car;
      
      if (i === winningPosition) {
        car = this.pendingWinner;
      } else {
        car = this.getRandomCarByRarity(config.rates);
      }
      
      const el = document.createElement('div');
      el.className = 'roulette-item';
      
      if (car.image) {
        el.innerHTML = `
          <img src="${car.image}" class="roulette-car-image" style="width:60px;height:60px;object-fit:contain;">
          <span class="car-name">${car.name}</span>
        `;
      } else {
        el.innerHTML = `
          <span class="car-icon">${car.icon}</span>
          <span class="car-name">${car.name}</span>
        `;
      }
      tape.appendChild(el);
    }
    
    setTimeout(() => {
      tape.style.transition = 'transform 4.5s cubic-bezier(0.2, 0.8, 0.3, 1)';
      const itemWidth = 140;
      const offset = winningPosition * itemWidth - (overlay.offsetWidth / 2 - itemWidth / 2);
      tape.style.transform = `translateX(-${offset}px)`;
    }, 100);
    
    setTimeout(() => {
      overlay.style.display = 'none';
      
      // НАХОДИМ МАШИНУ В КОЛЛЕКЦИИ ПО ID
      const carInCollection = this.carsCollection.find(c => c.id === this.pendingWinner.id);
      
      if (carInCollection) {
        if (carInCollection.owned) {
          console.log('⚠️ ДУБЛИКАТ:', this.pendingWinner.name);
          alert(`Вы получили дубликат: ${this.pendingWinner.name}! 🚗\n(Вы уже владеете этой машиной)`);
        } else {
          carInCollection.owned = true;
          console.log('✅ ДОБАВЛЕНА НОВАЯ МАШИНА:', this.pendingWinner.name);
        }
      } else {
        console.error('❌ ОШИБКА: Машина не найдена в коллекции!', this.pendingWinner.id);
      }
      
      // ПОКАЗЫВАЕМ МОДАЛКУ С ПОБЕДИТЕЛЕМ
      this.showCarModal(this.pendingWinner, true);
      this.canOpenCase = true;
      this.saveGame();
      this.updateGarage();
      this.pendingWinner = null;
    }, 4700);
  }

  selectWinner(rates) {
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedRarity = null;
    
    console.log('🎲 Шансы выпадения:', rates);
    console.log('🎲 Выпало число:', rand.toFixed(2));
    
    // ВЫБИРАЕМ РЕДКОСТЬ
    for (let rarity in rates) {
      cumulative += rates[rarity];
      if (rand < cumulative) {
        selectedRarity = rarity;
        break;
      }
    }
    
    console.log('🎲 Выбранная редкость:', selectedRarity);
    
    // НАХОДИМ ВСЕ МАШИНЫ ЭТОЙ РЕДКОСТИ
    const carsOfRarity = this.carsCollection.filter(car => car.rarity === selectedRarity);
    
    console.log('🎲 Доступные машины редкости', selectedRarity + ':', carsOfRarity.map(c => c.name));
    
    if (carsOfRarity.length === 0) {
      console.warn('⚠️ Нет машин редкости', selectedRarity, '! Берем первую машину');
      return JSON.parse(JSON.stringify(this.carsCollection[0]));
    }
    
    const randomIndex = Math.floor(Math.random() * carsOfRarity.length);
    const winner = JSON.parse(JSON.stringify(carsOfRarity[randomIndex]));
    
    console.log('🏆 ФИНАЛЬНЫЙ ПОБЕДИТЕЛЬ:', winner.name, 'Редкость:', winner.rarity);
    return winner;
  }

  getRandomCarByRarity(rates) {
    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedRarity = 'common';
    
    for (let rarity in rates) {
      cumulative += rates[rarity];
      if (rand < cumulative) {
        selectedRarity = rarity;
        break;
      }
    }
    
    const carsOfRarity = this.carsCollection.filter(car => car.rarity === selectedRarity);
    
    if (carsOfRarity.length === 0) {
      return JSON.parse(JSON.stringify(this.carsCollection[0]));
    }
    
    const randomIndex = Math.floor(Math.random() * carsOfRarity.length);
    return JSON.parse(JSON.stringify(carsOfRarity[randomIndex]));
  }

  showCarModal(car, isDrop = false) {
    const modal = document.getElementById('car-details-overlay');
    
    const rarityColors = {
      common: '#a0a0a0',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#fbbf24',
      special: '#ef4444',
      mythical: '#000000'
    };
    
    const rarityNames = {
      common: 'Обычная',
      rare: 'Редкая',
      epic: 'Эпическая',
      legendary: 'Легендарная',
      special: 'Особая',
      mythical: 'Мифическая'
    };
    
    const detIcon = document.getElementById('det-icon');
    if (car.image) {
      detIcon.innerHTML = `<img src="${car.image}" class="modal-car-image" style="width:150px;height:150px;object-fit:contain;">`;
    } else {
      detIcon.innerText = car.icon;
    }
    
    document.getElementById('det-name').innerText = car.name;
    const rarityElement = document.getElementById('det-rarity');
    rarityElement.innerText = rarityNames[car.rarity] || car.rarity.toUpperCase();
    rarityElement.style.background = rarityColors[car.rarity] || '#a0a0a0';
    
    document.getElementById('speed-value').innerText = car.speed;
    document.getElementById('accel-value').innerText = car.acceleration;
    document.getElementById('power-value').innerText = car.power;
    document.getElementById('handling-value').innerText = car.handling;
    
    document.getElementById('bar-speed').style.width = '0%';
    document.getElementById('bar-accel').style.width = '0%';
    document.getElementById('bar-power').style.width = '0%';
    document.getElementById('bar-handling').style.width = '0%';
    
    setTimeout(() => {
      document.getElementById('bar-speed').style.width = Math.min(100, car.speed) + '%';
      document.getElementById('bar-accel').style.width = Math.min(100, car.acceleration) + '%';
      document.getElementById('bar-power').style.width = Math.min(100, car.power) + '%';
      document.getElementById('bar-handling').style.width = Math.min(100, car.handling) + '%';
    }, 100);
    
    const btn = document.getElementById('modal-action-btn');
    
    if (isDrop) {
      btn.innerText = 'Забрать';
      btn.onclick = () => { 
        modal.style.display = 'none'; 
        this.saveGame(); 
        this.updateGarage();
      };
    } else {
      const carInCollection = this.carsCollection.find(c => c.id === car.id);
      
      btn.innerText = 'Выбрать';
      btn.onclick = () => {
        if (carInCollection && carInCollection.owned) {
          this.currentCarId = car.id;
          if (this.carSprite.setTexture) {
            this.carSprite.setTexture(car.id);
            this.carSprite.setDisplaySize(200, 200);
          } else {
            this.carSprite.setText(car.icon);
          }
        }
        modal.style.display = 'none';
        this.updateGarage();
        this.saveGame();
      };
    }
    modal.style.display = 'flex';
  }

  updateGarage() {
    const container = document.getElementById('garage-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const ownedCars = this.carsCollection.filter(car => car.owned);
    const ownedCount = ownedCars.length;
    const totalCars = this.carsCollection.length;
    
    const garageCount = document.getElementById('garage-count');
    if (garageCount) {
      garageCount.innerText = ownedCount;
    }
    
    if (ownedCars.length === 0) {
      container.innerHTML = '<div class="empty-garage">У вас пока нет автомобилей 🚗<br>Откройте кейс в магазине!</div>';
      this.updatePaginationControls();
      return;
    }
    
    const startIndex = (this.currentGaragePage - 1) * this.carsPerPage;
    const endIndex = Math.min(startIndex + this.carsPerPage, ownedCars.length);
    const carsToShow = ownedCars.slice(startIndex, endIndex);
    
    const rarityColors = {
      common: '#a0a0a0',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#fbbf24',
      special: '#ef4444',
      mythical: '#000000'
    };
    
    const rarityNames = {
      common: 'Обычная',
      rare: 'Редкая',
      epic: 'Эпическая',
      legendary: 'Легендарная',
      special: 'Особая',
      mythical: 'Мифическая'
    };
    
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(6, 1fr)';
    container.style.gap = '15px';
    
    carsToShow.forEach(car => {
      const item = document.createElement('div');
      item.className = `garage-item ${this.currentCarId === car.id ? 'active-car' : ''}`;
      
      if (car.image) {
        item.innerHTML = `
          <img src="${car.image}" class="garage-car-image" style="width:100%;height:100px;object-fit:contain;margin-bottom:10px;">
          <div class="car-name">${car.name}</div>
          <div class="car-rarity" style="background: ${rarityColors[car.rarity]}; color: ${car.rarity === 'mythical' ? '#fff' : '#000'}">${rarityNames[car.rarity]}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="car-icon-large">${car.icon}</div>
          <div class="car-name">${car.name}</div>
          <div class="car-rarity" style="background: ${rarityColors[car.rarity]}; color: ${car.rarity === 'mythical' ? '#fff' : '#000'}">${rarityNames[car.rarity]}</div>
        `;
      }
      
      item.onclick = () => this.showCarModal(car, false);
      container.appendChild(item);
    });
    
    const remainingSlots = this.carsPerPage - carsToShow.length;
    for (let i = 0; i < remainingSlots; i++) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'garage-item empty';
      emptyItem.style.opacity = '0.3';
      emptyItem.style.background = 'transparent';
      emptyItem.style.border = '1px dashed var(--glass-border)';
      emptyItem.innerHTML = '<div style="opacity:0;">Пусто</div>';
      container.appendChild(emptyItem);
    }
    
    this.updatePaginationControls();
  }

  addExperience(amount) {
    this.experience += amount;
    let leveledUp = false;
    
    while (this.experience >= this.getRequiredXP()) {
      this.experience -= this.getRequiredXP();
      this.level++;
      leveledUp = true;
      this.coins += 500;
      this.showLevelUpMessage();
    }
    
    if (leveledUp) {
      this.updateUI();
      this.saveGame();
    }
    
    this.updateXPBar();
  }

  getRequiredXP() {
    return Math.floor(100 + (this.level - 1) * 50);
  }

  showLevelUpMessage() {
    const { width, height } = this.scale;
    
    const levelUpText = this.add.text(width / 2, height / 2 - 50, 'LEVEL UP!', {
      fontSize: '48px',
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: '800',
      color: '#fbbf24',
      stroke: '#000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    const bonusText = this.add.text(width / 2, height / 2, `+500 🪙`, {
      fontSize: '32px',
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: '600',
      color: '#3b82f6',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    const levelText = this.add.text(width / 2, height / 2 + 50, `Уровень ${this.level}`, {
      fontSize: '28px',
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: '600',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: [levelUpText, bonusText, levelText],
      scale: 1.2,
      duration: 200,
      yoyo: true,
      ease: 'Bounce'
    });
    
    this.tweens.add({
      targets: [levelUpText, bonusText, levelText],
      alpha: 0,
      y: '-=50',
      duration: 2000,
      delay: 1000,
      onComplete: () => {
        levelUpText.destroy();
        bonusText.destroy();
        levelText.destroy();
      }
    });
    
    this.createConfetti();
  }

  createConfetti() {
    const { width, height } = this.scale;
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xfbbf24, 0x3b82f6];
    
    for (let i = 0; i < 50; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.add.rectangle(
        width / 2 + (Math.random() - 0.5) * 200,
        height / 2,
        Math.random() * 8 + 4,
        Math.random() * 8 + 4,
        color
      );
      
      this.tweens.add({
        targets: particle,
        x: particle.x + (Math.random() - 0.5) * 300,
        y: particle.y - 200 - Math.random() * 100,
        angle: Math.random() * 360,
        alpha: 0,
        scale: 0.5,
        duration: 1500 + Math.random() * 500,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  updateXPBar() {
    const xpFill = document.getElementById('xp-fill');
    const xpText = document.getElementById('xp-text');
    const levelText = document.getElementById('level-text');
    
    if (xpFill && xpText && levelText) {
      const currentXP = this.experience;
      const requiredXP = this.getRequiredXP();
      const percentage = (currentXP / requiredXP) * 100;
      xpFill.style.width = percentage + '%';
      xpText.innerText = `${currentXP} / ${requiredXP} XP`;
      levelText.innerText = `${this.level}`;
    }
  }

  updateUI() {
    document.getElementById('coins').innerText = Math.floor(this.coins);
    this.updateXPBar();
  }

  saveGame() {
    const gameData = {
      coins: this.coins,
      experience: this.experience,
      level: this.level,
      currentCarId: this.currentCarId,
      cars: this.carsCollection.map(car => ({
        id: car.id,
        owned: car.owned
      }))
    };
    localStorage.setItem('carClickerSave', JSON.stringify(gameData));
  }

  loadGame() {
    const saved = localStorage.getItem('carClickerSave');
    if (saved) {
      try {
        const gameData = JSON.parse(saved);
        this.coins = gameData.coins || 0;
        this.experience = gameData.experience || 0;
        this.level = gameData.level || 1;
        this.currentCarId = gameData.currentCarId || 'c1';
        
        this.carsCollection.forEach(car => {
          car.owned = false;
        });
        
        if (gameData.cars) {
          gameData.cars.forEach(savedCar => {
            const car = this.carsCollection.find(c => c.id === savedCar.id);
            if (car) car.owned = savedCar.owned;
          });
        }
        
        const currentCar = this.carsCollection.find(c => c.id === this.currentCarId);
        if (!currentCar || !currentCar.owned) {
          const firstOwned = this.carsCollection.find(c => c.owned);
          if (firstOwned) {
            this.currentCarId = firstOwned.id;
          } else {
            this.currentCarId = 'c1';
            const defaultCar = this.carsCollection.find(c => c.id === 'c1');
            if (defaultCar) defaultCar.owned = true;
          }
        }
      } catch (e) {
        console.error('Ошибка загрузки сохранения', e);
        this.carsCollection.forEach(car => {
          car.owned = car.id === 'c1';
        });
        this.currentCarId = 'c1';
      }
    } else {
      this.carsCollection.forEach(car => {
        car.owned = car.id === 'c1';
      });
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 500,
  height: 350,
  parent: 'game-placeholder',
  transparent: true,
  scene: MainScene,
  backgroundColor: '0x0a0a0f'
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});