const root = document.querySelector('#root');

// Функция для загрузки JSON
async function loadJSON() {
  try {
    const response = await fetch('./noteTree.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка загрузки JSON:', error);
    root.innerHTML = '<p>Ошибка загрузки данных</p>';
    return null;
  }
}

// Функция для создания оглавления
function createTOC(node, parentElement, level = 0) {
  if (!node.children || node.children.length === 0) return;
  
  const list = document.createElement('ul');
  if (level === 0) {
    list.classList.add('toc-root');
  }
  
  node.children.forEach(child => {
    const listItem = document.createElement('li');
    
    // Создаем ссылку или span в зависимости от типа
    let nameElement;
    
    if (child.type === 'file' && child.extension === '.md') {
      // Для файлов создаем ссылку
      nameElement = document.createElement('a');
      
      // Формируем путь к HTML файлу (предполагаем, что index.md -> index.html)
      const htmlPath = child.relativePath.replace(/\\/g, '/').replace(/\.md$/, '.html');
      nameElement.href = htmlPath;
      nameElement.textContent = child.name.replace(/\.md$/, ''); // убираем расширение .md
      
    } else if (child.type === 'directory') {
      // Для директорий создаем span (или можно сделать ссылку на index.html внутри директории)
      nameElement = document.createElement('span');
      nameElement.textContent = child.name;
      
      // Опционально: делаем директории тоже кликабельными
      // nameElement.style.cursor = 'pointer';
      // nameElement.addEventListener('click', () => {
      //   // Логика для раскрытия/скрытия поддиректорий
      // });
    } else {
      // Для других типов файлов
      nameElement = document.createElement('span');
      nameElement.textContent = child.name;
    }
    
    nameElement.classList.add(child.type);
    nameElement.classList.add(`level-${level}`);
    
    listItem.appendChild(nameElement);
    
    // Если это директория и у нее есть дети, рекурсивно создаем вложенный список
    if (child.type === 'directory' && child.children && child.children.length > 0) {
      createTOC(child, listItem, level + 1);
    }
    
    list.appendChild(listItem);
  });
  
  parentElement.appendChild(list);
}

// Функция для инициализации оглавления
async function initTOC() {
  try {
    // Очищаем root перед созданием нового оглавления
    root.innerHTML = '';
    
    // Загружаем данные
    const data = await loadJSON();
    
    if (!data) {
      root.innerHTML = '<p>Не удалось загрузить данные</p>';
      return;
    }
    
    // Создаем заголовок
    const title = document.createElement('h1');
    title.textContent = 'Оглавление';
    root.appendChild(title);
    
    // Создаем оглавление
    createTOC(data, root);
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    root.innerHTML = '<p>Ошибка создания оглавления</p>';
  }
}

// Запускаем создание оглавления при загрузке страницы
document.addEventListener('DOMContentLoaded', initTOC);