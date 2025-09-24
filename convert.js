const fs = require('fs');
const path = require('path');



async function buildFileTree(rootPath) {
  async function traverse(currentPath) {
    const stats = await fs.promises.stat(currentPath);
    const name = path.basename(currentPath);
    
    const node = {
      name: name,
      path: currentPath,
      type: stats.isDirectory() ? 'directory' : 'file',
      relativePath: path.relative(rootPath, currentPath)
    };
    
    if (stats.isDirectory()) {
      const items = await fs.promises.readdir(currentPath);
      node.children = [];
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const childNode = await traverse(itemPath);
        node.children.push(childNode);
      }
      
      // Сортируем: сначала папки, потом файлы
      node.children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } else {
      node.extension = path.extname(name).toLowerCase();
      node.size = stats.size;
    }
    
    return node;
  }
  
  return await traverse(rootPath);
}




async function convertTree(tree, outputRoot) {
  async function processNode(node, currentOutputPath) {
    if (node.type === 'directory') {
      // Пропускаем корневую папку (сам tree)
      if (node !== tree) {
        const dirPath = path.join(currentOutputPath, node.name);
        await fs.promises.mkdir(dirPath, { recursive: true });
      }
      
      if (node.children) {
        for (const child of node.children) {
          // Для корневой папки передаем outputRoot, для остальных - текущий путь
          const nextPath = node === tree ? currentOutputPath : path.join(currentOutputPath, node.name);
          await processNode(child, nextPath);
        }
      }
    } else if (node.type === 'file' && node.extension === '.md') {
      const htmlFileName = node.name.replace('.md', '.html');
      const htmlFilePath = path.join(currentOutputPath, htmlFileName);
      const mdFilePath = node.path;
      
      await convertMdToHtml(mdFilePath, htmlFilePath);
    }
  }
  
  await fs.promises.mkdir(outputRoot, { recursive: true });
  await processNode(tree, outputRoot);
}




async function convertMdToHtml(mdFilePath, htmlFilePath) {
  console.log(`Конвертируем: ${mdFilePath} -> ${htmlFilePath}`);
  const { spawn } = require('child_process');

  const pandoc = spawn('pandoc', ['-f', 'markdown', '-t', 'html', '-o', htmlFilePath]);

  const inputStream = fs.createReadStream(mdFilePath);
  inputStream.pipe(pandoc.stdin);

  pandoc.on('close', (code) => {
    console.log(`Процесс завершен с кодом: ${code}`);
  });

  pandoc.stderr.on('data', (data) => {
    console.error(`Ошибка: ${data}`);
  });
}




async function main() {
  try {
    const scriptDir = __dirname;
    const notesFolder = path.join(scriptDir, 'notes');

    const tree = await buildFileTree(notesFolder);
    // console.log(JSON.stringify(tree, null, 2));

    const targetFolder = path.join(scriptDir, 'docs');
    await convertTree(tree, targetFolder);

  } catch (error) {
    console.error('Ошибка:', error);
  }
}




main();