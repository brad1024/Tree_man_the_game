
/*
Note : 可以使用Global variable、socket 等等主檔的變數 (限function , Data 不行)
*/


// 選擇玩家按鈕  
var choose_player = new Vue({
  el: '#choose_player',
  
  methods:{
    Click: function(event){

      var value = event.currentTarget.value;

      PLAYER_ID = value;
      $("#pl1").hide();
      $("#pl2").hide();
      if(value == 1){
        $("#pl").text("你是玩家1");
        socket.emit("choose_character", 1);
      }
      else{
        $("#pl").text("你是玩家2");
        socket.emit("choose_character", -1);
      }
    }
  }
})

//城牆訊息
var wall_status = new Vue({
  el: '#wall_state',
  

  data: {
    walls: {
      "E":{  dir: '東' , hp:0 , maxhp:0 , progress:0  },
      "S":{ dir: '南' , hp:0 ,  maxhp:0 , progress:0   },
      "W":{ dir: '西' , hp:0 ,  maxhp:0 , progress:0   },
      "N":{ dir: '北' , hp:0 ,  maxhp:0 , progress:0   },
    },

  },

  methods: {
    update : function(roads){
      console.log(roads);
      
      if(roads){ //一定一開遊戲就會呼叫，這時roads還是NLL，會出錯
          
          var dirs = ["E","S","W","N"];
          for(var i = 0; i< dirs.length; i++){
            var d = dirs[i];
            this.walls[d].hp = roads[d].wallhp;
            this.walls[d].maxhp = roads[d].max_wallhp;
            this.walls[d].progress = (this.walls[d].hp *100 )/this.walls[d].maxhp;
          }

      }
      
    }
  }



})

