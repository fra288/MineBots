const figlet = require('figlet');
const chalk = require('chalk');
const inquirer = require('inquirer');
const mineflayer = require('mineflayer');
const Vec3 = require('vec3');

figlet.defaults({ horizontalLayout: 'full' });
const bots = new Map();

function header() {
  console.clear();
  console.log(chalk.magenta(figlet.textSync('MINE-BOT PANEL', { horizontalLayout: 'full' })));
  console.log(chalk.gray('Retro panel for controlling bots (use with permission)'));
  console.log(chalk.cyanBright(' '.repeat(50) + 'MADE BY @Grizzly Team'));
  console.log();
}

async function mainMenu() {
  header();
  console.log(chalk.green('Select an option by entering its number:\n'));
  console.log(chalk.yellow('1) Create bot(s)'));
  console.log(chalk.yellow('2) List bots'));
  console.log(chalk.yellow('3) Control bot'));
  console.log(chalk.yellow('4) Disconnect bot'));
  console.log(chalk.yellow('5) Disconnect everything and exit\n'));

  const { choice } = await inquirer.prompt([{ name: 'choice', message: 'Option:', validate: v => ['1','2','3','4','5'].includes(v) }]);

  switch (choice) {
    case '1': await createBotsPrompt(); break;
    case '2': await listBots(); break;
    case '3': await controlBotPrompt(); break;
    case '4': await disconnectBotPrompt(); break;
    case '5': await exitAll(); return;
  }

  await pauseAndContinue();
  await mainMenu();
}

async function createBotsPrompt() {
  const answers = await inquirer.prompt([
    { name: 'host', message: 'Server host or IP address', default: 'localhost' },
    { name: 'port', message: 'Port', default: 25565, validate: v => !isNaN(v) },
    { name: 'username', message: 'Bot Base Name', default: `bot` },
    { name: 'amount', message: 'How many bots should we create?', default: 1, validate: v => !isNaN(v) && v > 0 },
    { name: 'delay', message: 'Delay between connections (seconds)', default: 2, validate: v => !isNaN(v) && v >= 0 },
    { name: 'msgDelay', message: 'Delay between messages (seconds)', default: 3, validate: v => !isNaN(v) && v >= 1 },
    { name: 'joinMsg', message: 'Message they will say upon entering (empty for none)', default: '' },
    { name: 'repeatMsg', message: 'Repeat message automatically? (y/n))', default: 'y', validate: v => ['y','n','Y','N'].includes(v) },
  ]);

  const { host, port, username, amount, delay, msgDelay, joinMsg, repeatMsg } = answers;
  const password = '123456';
  const repeat = repeatMsg.toLowerCase() === 's';

  for (let i = 1; i <= amount; i++) {
    const botName = amount > 1 ? `${username}_${i}` : username;
    console.log(chalk.yellow(`Bot ${botName} (${i}/${amount}) joining the server...`));
    await createBot({ host, port: Number(port), username: botName, joinMsg, password, msgDelay, repeat });
    if (i < amount && delay > 0) {
      await new Promise(res => setTimeout(res, delay * 1000));
    }
  }
}

async function createBot({ host, port, username, joinMsg, password, msgDelay, repeat }) {
  try {
    const bot = mineflayer.createBot({ host, port, username });
    bot.ready = false;

    bot.once('spawn', () => {
      bot.ready = true;
      const startPos = bot.entity.position.clone();
      bot.setControlState('forward', true);
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
        bot.lookAt(startPos);
        if (joinMsg && joinMsg.trim() !== '') {
          const sendMsg = () => { bot.chat(joinMsg); console.log(chalk.green(`[💬] ${bot.username} sent your message`)); };
          sendMsg();
          if (repeat) setInterval(sendMsg, msgDelay * 1000);
        }
      }, 2000);
    });

    const id = `${username}@${host}:${port}-${Date.now()}`;
    bots.set(id, { bot, meta: { username, host, port } });

    bot.once('login', () => {
      console.log(chalk.green(`[✔] Bot ${username} connected and ready`));
    });

    bot.on('end', () => {
      console.log(chalk.yellow(`[i] Bot disconnected: ${username}`));
      bots.delete(id);
    });

    bot.on('error', err => console.log(chalk.red(`[!] Error in bot ${username}: ${err.message}`)));
  } catch (err) {
    console.log(chalk.red('Error creating bot:'), err.message);
  }
}

async function listBots() {
  header();
  console.log(chalk.cyan('Active bots:\n'));
  if (bots.size === 0) return console.log(chalk.gray('  (none)\n'));
  for (const [id, { meta, bot }] of bots.entries()) {
    const pos = bot.entity ? `x:${Math.floor(bot.entity.position.x)} y:${Math.floor(bot.entity.position.y)} z:${Math.floor(bot.entity.position.z)}` : 'no position';
    console.log(chalk.magenta(`- ${meta.username} @ ${meta.host}:${meta.port}`));
    console.log(`  ${pos}\n`);
  }
}

async function chooseBot(promptMsg = 'Select a bot') {
  if (bots.size === 0) {
    console.log(chalk.yellow('There are no active bots.'));
    return null;
  }
  const list = Array.from(bots.entries());
  list.forEach(([id, { meta }], i) => console.log(chalk.yellow(`${i + 1}) ${meta.username} (${meta.host}:${meta.port})`)));
  const { num } = await inquirer.prompt([{ name: 'num', message: promptMsg, validate: v => !isNaN(v) && v > 0 && v <= list.length }]);
  return list[parseInt(num) - 1][0];
}

async function controlBotPrompt() {
  const id = await chooseBot('Bot number:');
  if (!id) return;
  const { bot } = bots.get(id);

  console.log(chalk.green('\n1) Send chat'));
  console.log(chalk.green('2) Advance (simulation)'));
  console.log(chalk.green('3) Stop movement'));
  console.log(chalk.green('4) Look at coordinates'));
  console.log(chalk.green('5) Go back\n'));

  const { act } = await inquirer.prompt([{ name: 'act', message: 'Action:', validate: v => ['1','2','3','4','5'].includes(v) }]);

  switch (act) {
    case '1':
      const { text } = await inquirer.prompt([{ name: 'text', message: 'Mesagge:' }]);
      bot.chat(text);
      console.log(chalk.green('Message sent.'));
      break;

    case '2':
      bot.setControlState('forward', true);
      bot.setControlState('jump', true);
      setTimeout(() => { bot.setControlState('forward', false); bot.setControlState('jump', false); }, 2000);
      console.log(chalk.green('Simulated movement.'));
      break;

    case '3':
      bot.clearControlStates();
      console.log(chalk.green('Bot stopped.'));
      break;

    case '4':
      const look = await inquirer.prompt([
        { name: 'x', message: 'x', validate: v => !isNaN(v) },
        { name: 'y', message: 'y', validate: v => !isNaN(v) },
        { name: 'z', message: 'z', validate: v => !isNaN(v) }
      ]);
      bot.lookAt(new Vec3(+look.x, +look.y, +look.z));
      console.log(chalk.green('Bot looking.'));
      break;
  }
}

async function disconnectBotPrompt() {
  const id = await chooseBot('Bot number to disconnect:');
  if (!id) return;
  const { bot, meta } = bots.get(id);
  try { bot.quit(); } catch { bot.end(); }
  bots.delete(id);
  console.log(chalk.yellow(`Bot ${meta.username} disconnected.`));
}

async function exitAll() {
  for (const [id, { bot }] of bots.entries()) {
    try { bot.quit(); } catch { bot.end(); }
  }
  bots.clear();
  console.log(chalk.cyan('All bots are offline. Exiting...'));
  process.exit(0);
}

async function pauseAndContinue() {
  await inquirer.prompt([{ name: 'enter', message: 'Press Enter to continue', default: '' }]);
}

mainMenu().catch(err => {
  console.error(chalk.red('Application error:'), err);
  process.exit(1);
});

