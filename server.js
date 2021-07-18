
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const e = require('express');
var express = require('express');
const { env } = require('process');
//var missionCard = require("./missioncard.js");
//var itemCard = require("./itemcard.js");
//var mission = require("./mission.js");
//var item = require("./item.js");
//const itemcard = require('./itemcard.js');
var army = require('./army.js');
var enemy = require('./enemy.js');


app.get('/', function(req, res){
  res.sendFile(__dirname + '/main.html');
});

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});

app.use(express.static('public'));

class road{
  constructor(direction){
    this.wallhp = 500;
    this.direction = direction;
    this.max_distance = 21;
    this.nearest_enemy = -1;
    //this.hasEnemy = false;
    this.farest_army = -1;
    this.defence_troop = {"archer":0};
    this.army_location = [];
    this.enemy_location = [];
    for(var i=0; i<this.max_distance; i++){
      this.army_location[i] = [];
      this.enemy_location[i] = [];
    }
  }
  repairWall(repair_unit){
    this.wallhp = Math.max(this.wallhp + repair_unit*100, 1000);
  }
}


// ======= 選角相關變數&function

var player1HasBeenChoosen = false ;
var player2HasBeenChoosen = false; 


function chooseCharacter(id)
{
  if(id==1){
    console.log("player1 has been choosed");
    player1HasBeenChoosen = true;
  }else if(id==-1){
    console.log("player2 has been choosed");
    player2HasBeenChoosen = true;
  }
  io.emit("player_choosed", id);
}




// ========




class Environment {
  //環境變數
  constructor(){
    this.roads = {
        "E":new road("E") ,  
        "S":new road("S") ,
        "W":new road("W") ,
        "N":new road("N") , 
    }
    this.maxWallhp = 1000 ; 
    this.round = 1 ; 
    this.wood = 500 ;
    this.num_of_troop = { //目前記錄城內的兵種數目
        "archer":1 ,
        "armor":0 , 
        "ranger":0 ,
    }
    this.archer = [army.archer];
    this.armor = [];
    this.ranger = [];   
  }
};

//=========招募部隊=================
function recruit(type){
    if(type=='archer'){
      Env.wood -= army.archer.cost;
      Env.num_of_troop["archer"] += 1;
      Env.archer.push(army.archer); //len
    }
    else if(type=='armor'){
      Env.wood -= army.armor.cost;
      Env.num_of_troop["armor"] += 1;
      Env.armor.push(army.armor);
    }
    else if(type=='ranger'){
      Env.wood -= army.ranger.cost;
      Env.num_of_troop["ranger"] += 1;
      Env.ranger.push(army.ranger);
    }
}
//===================================

//========派出部隊======
function moveArmy(troop_type, direction){

  if(troop_type=="archer"){
    //console.log(Env.roads[direction].army_location);
    Env.roads[direction].defence_troop["archer"] += 1;
    Env.num_of_troop["archer"] -= 1;
  }
  else if(troop_type=="armor"){
    Env.roads[direction].army_location[0].push(army.armor);
    Env.num_of_troop["armor"] -= 1;
  }
  else if(troop_type=="ranger"){
    Env.roads[direction].army_location[0].push(army.ranger);
    Env.num_of_troop["ranger"] -= 1;
  }
}
//========================

//=========修牆===========
function repairWall(direction, unit){
  Env.wood -= unit*100;
  Env.roads[direction].wallhp = Math.min(Env.roads[direction].wallhp+unit*100, Env.maxWallhp);
  Env.wood -= unit*100;
}
//=======================

//==========偵查=========
function scout(dir){
  io.emit("scout_report", dir, Env.roads[dir].nearest_enemy);
  console.log("偵察了" + dir + "方向的敵人" + Env.roads[dir].nearest_enemy);
} 



var Env = null;

//============遊戲開始========
function newGame(){
  Env = new Environment();
}
//============================


//============接收玩家操作指令===============
function player_movement_update(action){
  console.log(action);
  if(action.type=='recruit')
    recruit(action.troop_type);
  else if(action.type=='move_army')
    moveArmy(action.troop_type, action.direction);
  else if(action.type=='repair_wall')
    repairWall(action.direction, action.unit);
  else if(action.type=='scout')
    scout(action.scout_dir);
}
//===========================================


// 機率決定 
function roll_the_dice(range=100){
  // Math.floor(Math.random() * 10) returns a random integer between 0 and 9 (both included):
  return (Math.floor(Math.random() * range)+1);
  
}





//==========回合結束判定======================

function roundCheck(){
  /*
  spawnEnemy();
  troopMove();
  enemyMove();
  */
  var combat_report = [];
  var dir = ["E", "W", "N", "S"];
  for(var d=0; d<dir.length; d++){
    spawnEnemy(dir[d]);
    troopMove(dir[d]);
    enemyMove(dir[d]);
    combat(dir[d], combat_report);
  }
  io.emit("combat_report", combat_report);
  console.log(Env.roads);
  console.log("戰報:"+combat_report);

  

  Env.round+=1;
  io.emit("turn_end",roll_the_dice()); //告知user此回合結束，並傳一個機率結果給接收端,先於game over才不會鎖住player2的按鈕
  isGameover();


  
  Env.wood += 500;
}
//=============================================


//===================交戰系統===================
/******當有敵方部隊進入攻擊範圍內，該部隊會停止移動並攻擊**********
*******一回合只有最前面的部隊會受到傷害***************************
 */
function combat(dir, total_report){
  
  var army_attack = 0;
  var enemy_attack = 0;
  var isCombat = false;
  var farest_army = Env.roads[dir].farest_army;
  var nearest_enemy = Env.roads[dir].nearest_enemy;
  
  if(nearest_enemy!=-1){
    var nearest_enemy_hp = Env.roads[dir].enemy_location[nearest_enemy][0].hp;
  }
  if(farest_army!=-1){
    var farest_army_hp = Env.roads[dir].army_location[farest_army][0].hp;
  }

  if(nearest_enemy!=-1){
    for(var i=0; i<Env.roads[dir].max_distance; i++){
      for(var j=0; j<Env.roads[dir].army_location[i].length; j++){
        if(Env.roads[dir].army_location[i][j].attack_range + i >= nearest_enemy){
          army_attack += Env.roads[dir].army_location[i][j].attack;
        }
      }
    }
    if(nearest_enemy<=3){
      army_attack += Env.roads[dir].defence_troop["archer"] * army.archer.attack;
    }
  }

  
  for(var i=0; i<Env.roads[dir].max_distance; i++){
    for(var j=0; j<Env.roads[dir].enemy_location[i].length; j++){
      if(farest_army==-1 && i - Env.roads[dir].enemy_location[i][j].attack_range <= 0){ //no troop
        enemy_attack += Env.roads[dir].enemy_location[i][j].attack;
      }
      else if(i - Env.roads[dir].enemy_location[i][j].attack_range <= farest_army){
        enemy_attack += Env.roads[dir].enemy_location[i][j].attack;
      }
    }
  }
  console.log(army_attack + "  " + enemy_attack);
  if(army_attack || enemy_attack){
    isCombat = true;
  }
/*
  if(Env.roads[dir].hasEnemy){
    var nearest_enemy_hp = Env.roads[dir].enemy_location[nearest_enemy][0].hp;
    if(Env.roads[dir].farest_army!=-1){
      var farest_army_hp = Env.roads[dir].army_location[farest_army][0].hp;

      for(var loc=0; loc<20; loc++){
        if(Env.roads[dir].army_location[Env.roads[dir].farest_army].length)
          troop_num = Env.roads[dir].army_location[loc].length;
        for(var i=0; i<troop_num; i++){
          if(Env.roads[dir].army_location[loc][i].attack_range + loc >= Env.roads[dir].nearest_enemy){
            army_attack += Env.roads[dir].army_location[loc][i].attack;
            army_attack += Env.roads[dir].army_location[loc][i].attack_damage(Env.roads[dir].nearest_enemy);
            isCombat = true;
        }

        if(Env.roads[dir].enemy_location[Env.roads[dir].nearest_enemy].length)
          enemy_num = Env.roads[dir].enemy_location[loc].length;
        for(var i=0; i<enemy_num; i++){
          if(loc - Env.roads[dir].enemy_location[loc][i].attack_range <= Env.roads[dir].farest_army){
            enemy_attack += Env.roads[dir].enemy_location[loc][i].attack;
            isCombat = true;
          }
        }
      } 
    army_attack += army.archer.attack_damage(Env.roads[dir].nearest_enemy) * Env.roads[dir].archer_amount;//計算弓箭手傷害
*/
  var combat_report={
                    "direction":dir, //交戰方向
                    "location":0, //交戰位置
                    "wall_damaged":false, //城牆是否被攻擊
                    "army_attack":army_attack, //部隊造成的傷害
                    "enemy_attack":enemy_attack, //樹人造成的傷害
                    "army_hp":0, //最前方部隊剩餘血量
                    "enemy_hp":0, //最近樹人剩餘血量
                    "reward":0}; //擊殺樹人獎勵
  console.log(isCombat);
  if(isCombat){
    if(farest_army==-1 && enemy_attack!=0){
      console.log("樹人到城牆下啦");
      Env.roads[dir].wallhp = Math.max(0, Env.roads[dir].wallhp-enemy_attack);
      combat_report["wall_damaged"] = true;
    }
    else if(farest_army!=-1){
      farest_army_hp = Math.max(0, farest_army_hp - enemy_attack);
      combat_report["army_hp"] = farest_army_hp;
      combat_report["location"] = farest_army;
      Env.roads[dir].army_location[farest_army][0].hp = farest_army_hp;
    }
    
    nearest_enemy_hp = Math.max(0, nearest_enemy_hp - army_attack);
    combat_report["enemy_hp"] = nearest_enemy_hp;
    Env.roads[dir].enemy_location[nearest_enemy][0].hp = nearest_enemy_hp;

    if(nearest_enemy_hp==0){
      var reward = Env.roads[dir].enemy_location[nearest_enemy][0].reward;
      Env.wood += reward;
      combat_report["reward"] = reward;
      Env.roads[dir].enemy_location[nearest_enemy].splice(0, 1);
      console.log("消滅樹人");
    }

    if(farest_army_hp==0){
      Env.roads[dir].army_location[farest_army].splice(0, 1);
      console.log("部隊被殲滅");
    }
    total_report.push(combat_report);
    console.log(combat_report);
  }
  
}
//===============================================================================


//回合結束部隊自動移動=======================
function troopMove(dir){
  for(var i=19; i>=0; i--){
    if(Env.roads[dir].army_location[i].length){
      for(var j=0; j<Env.roads[dir].army_location[i].length;){
        var move_to = Math.min(Env.roads[dir].army_location[i][j].move_distance+i, 20, Env.roads[dir].nearest_enemy-Env.roads[dir].army_location[i][j].attack_range); 
        move_to = Math.max(move_to, 0);
        if(move_to!=i){
          Env.roads[dir].army_location[move_to].push(Env.roads[dir].army_location[i][j]);
          Env.roads[dir].army_location[i].splice(j, 1);
        } 
        else j++;

      }
    }
  }
  Env.roads[dir].farest_army = -1;
  for(var i=20; i>=0; i--){
    if(Env.roads[dir].army_location[i].length){
      Env.roads[dir].farest_army = i;
      break;
    }
  }
}


function enemyMove(dir){
  for(var i=0; i<21; i++){
    if(Env.roads[dir].enemy_location[i].length){
      for(var j=0; j<Env.roads[dir].enemy_location[i].length;){
        var move_to = Math.max(i-Env.roads[dir].enemy_location[i][j].move_distance, 0);
        move_to = Math.max(move_to, Env.roads[dir].farest_army + Env.roads[dir].enemy_location[i][j].attack_range); 
        if(move_to!=i){
          Env.roads[dir].enemy_location[move_to].push(Env.roads[dir].enemy_location[i][j]); 
          Env.roads[dir].enemy_location[i].splice(j, 1);
        }
        else j++;
        
      }
    }
  }
  //Env.roads[dir].hasEnemy = false;
  Env.roads[dir].nearest_enemy = -1;
  for(var i=0; i<21; i++){
    if(Env.roads[dir].enemy_location[i].length){
      //Env.roads[dir].hasEnemy = true;
      Env.roads[dir].nearest_enemy = i;
      break;
    }
  }

}
//=========================================================


//生成敵人(隨機)==================================
function spawnEnemy(dir){
  var spawn = Math.floor(Math.random()*4);
  if(spawn==0){
    Env.roads[dir].enemy_location[20].push(enemy.treeMan);
  }
}
//=============================================

function isGameover(){
  if(Env.roads["E"].wallhp<=0 || Env.roads["W"].wallhp<=0 || Env.roads["N"].wallhp<=0 || Env.roads["S"].wallhp<=0){
    console.log("gameover");
    io.emit("gameover");
  }
}

io.on('connection', (socket) => {

  socket.emit("welcome", player1HasBeenChoosen , player2HasBeenChoosen);

  // 選角  =============================================
  socket.on("choose_character", (id)=>{
    chooseCharacter(id);
    if(player1HasBeenChoosen && player2HasBeenChoosen){
      newGame();
      io.emit("start_game");
      io.emit("player_turn");
      //console.log("start game");

      //test
      Env.wood += 5000;
    
      io.emit("update_state", Env);
      io.emit("player_turn");
    }
  });
  //  =================================================


 





  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));


 

  //每回合結算玩家的行動並更新環境
  socket.on("action_done", (player_id, action ,msg)=>{ //玩家的訊息
    
    io.emit("player_msg",msg);

    if(player_id==1){
      player_movement_update(action);
      io.emit("update_state", Env);
      io.emit("player_turn");
    }
    else if(player_id==-1){
      player_movement_update(action);
      roundCheck();
      io.emit("update_state", Env);
      io.emit("player_turn");
    }
  });
  //===================================================
})















