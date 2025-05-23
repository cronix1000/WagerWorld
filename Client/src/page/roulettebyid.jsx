import React, { useEffect, useRef, useState } from 'react'
import { Client, Room } from 'colyseus.js'
import Phaser from 'phaser'
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, getFirestore } from "firebase/firestore";
const db = getFirestore();


// wheel animation based off https://phaser.io/news/2018/08/wheel-of-fortune-tutorial

var game;
 
var gameOptions = {
 
    // slices (numbers) placed in the wheel
    slices: 37,
 
    // numbers and color, starting from 12 o'clock going clockwise
    // black=0, red=1
    sliceValues: [[0, -1], [32, 1], [15, 0], [19, 1], [4, 0], [21, 1], [2, 0], [25, 1], [17, 0], [34, 1], [6, 0], [27, 1], [13, 0], [36, 1], [11, 0], [30, 1], [8, 0], [23, 1], [10, 0], [5, 1], [24, 0], [16, 1], [33, 0], [1, 1], [20, 0], [14, 1], [31, 0], [9, 1], [22, 0], [18, 1], [29, 0], [7, 1], [28, 0], [12, 1], [35, 0], [3, 1], [26, 0]],
 
    // length of animation
    rotationTime: 6000
}
 
// Phaser scene
class RouletteScene extends Phaser.Scene{

    constructor(){
        super({ key: 'RouletteScene' })
        this.client = new Client(`${import.meta.env.VITE_COLYSEUS_URL}`)
        this.room = Room
        this.sessionID
        this.player2 = {sessionId: null, name: null, isReady: false, bet: 0, total: 0, lastSpin: 0}
        this.player3 = {sessionId: null, name: null, isReady: false, bet: 0, total: 0, lastSpin: 0}
        this.ready = false
    }

    // index, of chip clicked, to be passed to server
    inputPayload = {
        chipIndex: 0,
    }
 
    preload(){
        // images
        // logo (credit goes to Mike)
        this.load.image("logo", "/roulette/roulette-logo.png")
        // roulette wheel @ https://www.vexels.com/png-svg/preview/151205/roulette-wheel-icon
        this.load.image("wheel", "/roulette/roulette-wheel.png")
        this.load.image("wheel-bg", "/roulette/roulette-wheel-bg.png")
        // bet table @ https://www.freepik.com/premium-vector/american-roulette-table-layout-with-bets-options_237485384.htm
        this.load.image("betTable", "/roulette/betTable.jpg")
        this.load.image("chip", "/roulette/chip.png")
    }

    init(data) 
    {
        console.log("Init: ", data.roomId);
        this.roomId = data.roomId;
    }
 
    async create(){

        const playerId = localStorage.getItem("firebaseIdToken");
        const userRef = doc(db, "users", playerId);
        const userDoc = await getDoc(doc(db, "users", playerId));

        try
        {
            if(userDoc.exists() && userDoc.data().isInGame)
            {
                console.log(`Player with ID is already in a game.`);
                // open popup to inform user that they are already in a game and redirect to home page
                // redirect to home page
                window.location.href = "/";
                return
            }

            // update isInGame to true
            await updateDoc(userRef, {
              isInGame: true
            });
        }
        catch (error) 
        {
            console.error('Error fetching player data: ', error);
        }

        try {
            const firestoreBalance = userDoc.data().balance || 10000;
            console.log(firestoreBalance)
            this.userBal = firestoreBalance
            this.newUserBal = this.userBal // temp save necessary in case page is refreshed before the wheel is spun     

            this.room = await this.client.joinById(this.roomId, { playerId: playerId || "anonymous", balance: firestoreBalance});
            console.log("Joined successfully!")
        } catch (e) {
            console.error(e)
        }

        // ************************--TO-DO--************************ //
        // get user balance from db
        // ********************************************************* //
        // this.newUserBal = 10000 // temp save necessary in case page is refreshed before the wheel is spun     

        // get window size
        const sceneWidth = this.scale.width
        const sceneHeight = this.scale.height

        const centerX = this.scale.width / 2
        const scaleFactor = Math.min(sceneWidth / 1600, sceneHeight / 850)

        // scene container
        this.sceneContainer = this.add.container(centerX, 0);
        this.sceneContainer.setScale(scaleFactor)
        //this.scale.on('resize', this.resizeScene, this); // not doing anything... why?

        // logo
        this.logo = this.add.image(0, 50, "logo")
        this.logo.setScale(0.5)
        this.sceneContainer.add(this.logo)

        // roulette_wheel @ @ https://www.vexels.com/png-svg/preview/151205/roulette-wheel-icon
        // set for input and add circular hit area
		this.roulette_wheel = this.add.sprite(0, 299, "wheel").setInteractive(new Phaser.Geom.Circle(240.5, 240.5, 235), Phaser.Geom.Circle.Contains);
		this.roulette_wheel.setScale(0.8)
        this.sceneContainer.add(this.roulette_wheel)
        // listener to call spinWheel
        this.roulette_wheel.on("pointerdown", () => {  
            this.spinWheel()
        })

		// roulette_wheel_bg
		this.roulette_wheel_bg = this.add.image(0, 299, "wheel-bg");
		this.roulette_wheel_bg.setScale(0.77)
        this.roulette_wheel_bg.angle = -0.5
        this.sceneContainer.add(this.roulette_wheel_bg)

		// betTable @ https://stock.adobe.com/search?k=roulette+table&asset_id=409514024
		this.betTable = this.add.image(0, 700, "betTable");
		this.betTable.setScale(0.85)
		//this.betTable.angle = 90; // used with first version where p1's bet table is vertical on the left
        this.sceneContainer.add(this.betTable)

        // info text field (centered horizontally relative to roulette wheel)
        this.txt_info = this.add.text(this.roulette_wheel.x, 525, "", {})
        this.txt_info.setStyle({"align": "center", "fontSize": "24px"})
        this.txt_info.setOrigin(0.5, 0)
        this.sceneContainer.add(this.txt_info)

        // user balance text field
        this.txt_userBal = this.add.text(-275, 560, `Balance: ${this.userBal} credits`, {})
        this.txt_userBal.setStyle({"align": "center", "fontSize": "24px"})
        this.sceneContainer.add(this.txt_userBal)

        // result of roulette spin text field
        this.txt_spinResult = this.add.text(-30, 82, "", {})
        this.sceneContainer.add(this.txt_spinResult)

        // ready button
        this.graphics = this.add.graphics();
        this.graphics.fillStyle(0xFFA500, 1);
        this.graphics.fillRoundedRect(160, 525, 125, 50, 10);
        this.sceneContainer.add(this.graphics)
        // inner text
        this.txt_readyBtn = this.add.text(180, 538, 'READY', {
            fontSize: '28px',
            fontStyle: 'bold',
            align: 'center'
        })
            .setInteractive()
            .on("pointerdown", () => {
                this.txt_readyBtn.setStyle({color: '#BF7C00'})
                if (this.betsPlaced && !this.ready)
                    this.room.send("ready")
            })
        this.sceneContainer.add(this.txt_readyBtn)

        // arrays for betting logic
        this.straightUp = new Array(36) //35:1
        //this.split = new Array(57) //17:1
        //this.street = new Array(12) //11:1
        //this.cornerBet = new Array(22) //8:1
        //this.fiveNumber //6:1
        //this.line = new Array(11) //5:1
        this.dozensCols = new Array(6) //2:1
        this.evenMoney = new Array(6)

        // Create a container for chips relative to the betTable
        this.chipContainer = this.add.container(this.betTable.x, this.betTable.y);
        // sync scale so chips dynamically shift position as needed
        this.chipContainer.setScale(this.betTable.scaleX, this.betTable.scaleY)
        this.sceneContainer.add(this.chipContainer)

        // Adjust these values based on betTable alignment
        const chipOffsetX = -14;
        const chipOffsetY = -261;

        // Position chips relative to betTable
        this.chips = new Array(); // store chip references
        var x = chipOffsetX; // Starting position relative to betTable
        var y = chipOffsetY;
        var chipScale = 0.20
        
        /* add all chip images to bet table */
        // straight-up bet chips
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 3; j++) { 
                // index to be used in bet logic 
                let index = i * 3 + j;

                // Create chip at a relative position
                let chip = this.add.image(x, y, "chip")
                chip.scaleX = chipScale
                chip.scaleY = chipScale

                // Set interactive
                chip.type = 0 // Bet type
                chip.index = index
                chip.setInteractive()
                chip.on("pointerdown", () => {
                    if (this.canSpin && !this.ready)
                        this.onChipClicked(chip)
                })

                // Add chip to container (relative positioning)
                this.chipContainer.add(chip)

                this.chips.push(chip) // Store reference
                x += 59 // Move across row
            }
            y += 47.6 // Move down column
            x = chipOffsetX; // Reset X position for new row
        }
        
        // dozens
        x = chipOffsetX - 48
        y = chipOffsetY + 20
        for (let i=0; i<3; i++) {
            // chip creation
            let chip = this.add.image(x, y, "chip")
            chip.scaleX = chipScale
            chip.scaleY = chipScale

            // set interactive
            chip.type = 6 // for bet logic
            chip.index = i
            chip.setInteractive(new Phaser.Geom.Rectangle(66, -75, 160, 900), Phaser.Geom.Rectangle.Contains)
            chip.on("pointerdown", () =>{
                if (this.canSpin && !this.ready)
                    chip.alpha = 0.01
                    this.onChipClicked(chip)
            })

            this.chipContainer.add(chip)
            this.chips.push(chip)
            y += 190.4
        }
        // columns
        x = chipOffsetX
        y = chipOffsetY + 571.2
        for (let i=3; i<6; i++) {
            // chip creation
            let chip = this.add.image(x, y, "chip")
            chip.scaleX = chipScale
            chip.scaleY = chipScale

            // set interactive
            chip.type = 6 // for bet logic
            chip.index = i
            chip.setInteractive()
            chip.on("pointerdown", () =>{
                if (this.canSpin && !this.ready)
                    chip.alpha = 0.01
                    this.onChipClicked(chip)
            })

            this.chipContainer.add(chip)
            this.chips.push(chip)
            x += 59
        }

        // even money
        x = chipOffsetX - 84
        y = chipOffsetY + 25
        for (let i=0; i<6; i++) {
            // chip creation
            let chip = this.add.image(x, y, "chip")
            chip.scaleX = chipScale
            chip.scaleY = chipScale

            // set interactive
            chip.type = 7 // for bet logic
            chip.index = i
            chip.setInteractive(new Phaser.Geom.Rectangle(66, -110, 160, 450), Phaser.Geom.Rectangle.Contains)
            chip.on("pointerdown", () =>{
                if (this.canSpin && !this.ready)
                    chip.alpha = 0.01
                    this.onChipClicked(chip)
            })

            this.chipContainer.add(chip)
            this.chips.push(chip)
            y += 95
        }
        this.chipContainer.angle = -90 // angle due to chips initially aligned to vertical bet table

        /* other players */
        // betting tables
        this.p2BetTable = this.add.image(-460, 295, "betTable");
		this.p2BetTable.setScale(0.85)
		this.p2BetTable.angle = 90;
        this.sceneContainer.add(this.p2BetTable)

        this.p3BetTable = this.add.image(460, 295, "betTable");
		this.p3BetTable.setScale(0.85)
		this.p3BetTable.angle = -90;
        this.sceneContainer.add(this.p3BetTable)

        // text fields
        this.txt_p2Name = this.add.text(-770, 50, "[NO PLAYER]", {
            fontSize: '28px',
            fontStyle: 'bold',
            wordWrap: {width: 210}
        })
        this.sceneContainer.add(this.txt_p2Name)

        this.txt_p2Info = this.add.text(-770, 110, "", {
            fontSize: '24px',
            wordWrap: {width: 210}
        })
        this.sceneContainer.add(this.txt_p2Info)

        this.txt_p3Name = this.add.text(575, 50, "[NO PLAYER]", {
            fontSize: '28px',
            fontStyle: 'bold',
            wordWrap: {width: 210}
        })
        this.sceneContainer.add(this.txt_p3Name)

        this.txt_p3Info = this.add.text(575, 110, "", {
            fontSize: '24px',
            wordWrap: {width: 210}
        })
        this.sceneContainer.add(this.txt_p3Info)


        // chip containers
        // *************** BROKEN: positioning and scaling no bueno. orientation is correct though... ************** //
        this.p2Container = this.add.container(this.p2BetTable.x, this.p2BetTable.y)
        this.p2Container.setScale(this.p2BetTable.scaleX, this.p2BetTable.scaleY)
        this.populateBetTables(this.p2Container)
        this.sceneContainer.add(this.p2Container)
        
        this.p3Container = this.add.container(this.p3BetTable.x, this.p3BetTable.y)
        this.p3Container.setScale(this.p3BetTable.scaleX, this.p3BetTable.scaleY)
        this.populateBetTables(this.p3Container)
        this.p3Container.angle = 180
        this.sceneContainer.add(this.p3Container)

        this.reset() // all bets=0 and hide chips


        // get session ID and other players' states
        this.room.onMessage("joinConfirm", (payload) => {
            this.sessionID = payload.sessionId
            console.log(`Session ID: ${this.sessionID}`)
            if (payload.otherPlayers[0] != null) {
                var player = payload.otherPlayers[0]
                // update p2 data structure
                this.player2.sessionId = player.sessionId
                this.player2.name = player.name
                this.player2.isReady = player.isReady
                this.player2.bet = player.bet
                this.player2.total = player.total
                // update info text
                this.updateP2Txt(this.player2.lastSpin)
                // reveal chips already on p2's bet table
                this.updateBetTables(this.p2Container, player.chipAlphas)
            }
            if (payload.otherPlayers[1] != null) {
                var player = payload.otherPlayers[1]
                // update p3 data structure
                this.player3.sessionId = player.sessionId
                this.player3.name = player.name
                this.player3.isReady = player.isReady
                this.player3.bet = player.bet
                this.player3.total = player.total
                // update info text
                this.updateP3Txt(this.player3.lastSpin)
                // reveal chips already on p3's bet table
                this.updateBetTables(this.p3Container, player.chipAlphas)
            }
        })

        // add new players who join
        this.room.state.players.onAdd((player, sessionId) => {
            if (this.sessionID == null) return // if it's its own connection response
            else {
                if (this.player2.sessionId == null) {
                    this.player2.sessionId = sessionId
                    this.player2.name = player.name
                    this.player2.isReady = player.isReady
                    this.player2.bet = player.bet
                    this.player2.total = player.total
                    this.updateP2Txt(this.player2.lastSpin)
                }
                else if (this.player3.sessionId == null) {
                    this.player3.sessionId = sessionId
                    this.player3.name = player.name
                    this.player3.isReady = player.isReady
                    this.player3.bet = player.bet
                    this.player3.total = player.total
                    this.updateP3Txt(this.player3.lastSpin)
                }
                console.log(`P2: ${this.player2.sessionId}\nP3: ${this.player3.sessionId}`)
            }
        })

        // receive updated info
        this.room.onMessage("betPlaced", (payload) => {
            // update betting tables
            const sessionId = payload.sessionId
            const index = payload.chipIndex
            // update player corresponding to sessionId passed
            if (sessionId == this.player2.sessionId) {
                // reveal chip
                this.p2Container.getAt(index).alpha = 100
                this.player2.bet = payload.bet
                this.updateP2Txt(this.player2.lastSpin)
            }
            else if (sessionId == this.player3.sessionId) {
                this.p3Container.getAt(index).alpha = 100
                this.player3.bet = payload.bet
                this.updateP3Txt(this.player3.lastSpin)
            }
        })

        // update player ready status
        this.room.onMessage("playerReady", (payload) => {
            // update player info
            const sessionId = payload.sessionId
            const isReady = payload.isReady
            // update player corresponding to sessionId passed
            if (sessionId == this.player2.sessionId) {
                this.player2.isReady = isReady
                this.updateP2Txt(this.player2.lastSpin)
            }
            else if (sessionId == this.player3.sessionId) {
                this.player3.isReady = isReady
                this.updateP3Txt(this.player3.lastSpin)
            }
        })

        // done spinning wheel
        this.room.onMessage("resetGame", (payload) => {
            // update player info
            const sessionId = payload.sessionId
            const profit = payload.profit
            const total = payload.total
            // update player corresponding to sessionId passed
            if (sessionId == this.player2.sessionId) {
                this.player2.isReady = false
                this.player2.bet = 0
                this.player2.total = total
                this.player2.lastSpin = profit
                this.updateP2Txt(this.player2.lastSpin)
            }
            else if (sessionId == this.player3.sessionId) {
                this.player3.isReady = false
                this.player3.bet = 0
                this.player3.total = total
                this.player3.lastSpin = profit
                this.updateP3Txt(this.player3.lastSpin)
            }
        })

        // clear bet table and info of player who left
        this.room.onMessage("playerLeft", (payload) => {
            if (payload.sessionId == this.player2.sessionId) {
                this.player2.sessionId = null
                this.player2.name = null
                this.player2.isReady = false
                this.player2.bet = 0
                this.player2.total = 0
                this.txt_p2Name.setText("[NO PLAYER]")
                this.txt_p2Info.setText("")
                this.p2Container.getAll().forEach(chip => {
                    chip.alpha = 0.01
                })
            }
            else if (payload.sessionId == this.player3.sessionId) {
                this.player3.sessionId = null
                this.player3.name = null
                this.player3.isReady = false
                this.player3.bet = 0
                this.player3.total = 0
                this.txt_p3Name.setText("[NO PLAYER]")
                this.txt_p3Info.setText("")
                this.p3Container.getAll().forEach(chip => {
                    chip.alpha = 0.01
                })
            }
        })

        // all players have readied up, calculations made, and its time to spin that wheel
        this.room.onMessage("spinWheel", (payload) => {
            this.spinWheel(payload.rounds, payload.degrees, payload.spinResult)
        })
    }

    spinWheel(rounds, degrees, spinResult){
        if(this.canSpin && this.betsPlaced){
            // // number of rotations
            // var rounds = Phaser.Math.Between(2, 4);
            // // randomly selected stopping point
            // var degrees = Phaser.Math.Between(0, 360);
            // var spinResult = gameOptions.slices - 1 - Math.floor(degrees / (360 / gameOptions.slices));
            var value = gameOptions.sliceValues[spinResult]

            this.canSpin = false;

            var payout = this.payout(value)
            this.newUserBal += payout

            var profit = this.newUserBal - this.userBal
            console.log(this.newUserBal, this.userBal, profit)

            // ******************************************************* //
            // update user balance in db
            this.userBal = this.newUserBal
            // ******************************************************* //
 
            // animation with quadratic to simulate friction
            this.tweens.add({
                // adding the wheel to tween targets
                targets: [this.roulette_wheel],
                // angle destination
                angle: 360 * rounds + degrees,
                // tween duration
                duration: gameOptions.rotationTime,
                // tween easing
                ease: "Cubic.easeOut",
                // callback scope
                callbackScope: this,
 
                // function to be executed once the tween has been completed
                onComplete: function(tween){
                    var resultTxt
                    if (value[1] == 0)
                        resultTxt = "Black "
                    else if (value[1] == 1)
                        resultTxt = "Red "
                    else
                        resultTxt = "  "
                    resultTxt += value[0]
                    this.txt_spinResult.setText(resultTxt)

                    if (payout == 0)
                        this.txt_info.setText("You lose.")
                    else
                        this.txt_info.setText(`${payout} credit payout!`)
                    this.txt_userBal.setText(`Balance: ${this.newUserBal} credits`)
                    setTimeout(() => {
                        // wait a couple seconds before hiding chips and resetting bets
                        this.reset()
                        this.room.send("resetGame", {profit: profit})
                    }, 3000)
                }
            });
        }
    }

    onChipClicked(chip) {
        // make chip visible
        chip.alpha = 100

        // update payload and send to server
        this.inputPayload.chipIndex = this.chipContainer.getIndex(chip)
        this.room.send("bet", this.inputPayload)

        // different logic for each type of bet
        if (this.userBal >= 10) {
            switch (chip.type) {
                case 0:
                    // straight up, 35:1
                    this.straightUp[chip.index] += 10
                    this.txt_info.setText(`${this.straightUp[chip.index]} credits on ${chip.index + 1}`)
                    break

                case 1:
                    // split, 17:1
                    this.txt_info.setText("This is a split bet")
                    break
                case 2:
                    // street, 11:1
                    this.txt_info.setText("This is a street bet")
                    break
                case 3:
                    // corner bet, 8:1
                    this.txt_info.setText("This is a corner bet")
                    break
                case 4:
                    // five number bet, 6:1
                    this.txt_info.setText("This is a five number bet")
                    break
                case 5:
                    // line, 5:1
                    this.txt_info.setText("This is a line bet")
                    break

                case 6:
                    // dozens and columns, 2:1
                    this.dozensCols[chip.index] += 10
                    var txt = `${this.dozensCols[chip.index]} credits on `
                    if (chip.index == 0) {
                        txt += `1st dozen`
                    } else if (chip.index == 1) {
                        txt += `2nd dozen`
                    } else if (chip.index == 2) {
                        txt += `3rd dozen`
                    } else if (chip.index == 3) {
                        txt += `1st column`
                    } else if (chip.index == 4) {
                        txt += `2nd column`
                    } else if (chip.index == 5) {
                        txt += `3rd column`
                    }
                    this.txt_info.setText(txt)
                    break

                case 7:
                    // dozens and columns, 2:1
                    this.evenMoney[chip.index] += 10
                    var txt = `${this.evenMoney[chip.index]} credits on `
                    if (chip.index == 0) {
                        txt += `first 18`
                    } else if (chip.index == 1) {
                        txt += `Even`
                    } else if (chip.index == 2) {
                        txt += `Red`
                    } else if (chip.index == 3) {
                        txt += `Black`
                    } else if (chip.index == 4) {
                        txt += `Odd`
                    } else if (chip.index == 5) {
                        txt += `last 18`
                    }
                    this.txt_info.setText(txt)
                    break
            }
            this.newUserBal -= 10
            this.txt_userBal.setText(`Balance: ${this.newUserBal} credits`)
        }
        else {
            this.txt_info.setText("Out of credits")
        }
        this.betsPlaced = true
    }

    reset() {
        // set all bets to 0
        for (let i = 0; i < this.straightUp.length; i++) {
            this.straightUp[i] = 0;
        }
        // for (let i = 0; i < this.split.length; i++) {
        //     this.split[i] = 0;
        // }
        // for (let i = 0; i < this.street.length; i++) {
        //     this.street[i] = 0;
        // }
        // for (let i = 0; i < this.cornerBet.length; i++) {
        //     this.cornerBet[i] = 0;
        // }
        // for (let i = 0; i < this.line.length; i++) {
        //     this.line[i] = 0;
        // }
        for (let i = 0; i < this.dozensCols.length; i++) {
            this.dozensCols[i] = 0;
        }
        for (let i = 0; i < this.evenMoney.length; i++) {
            this.evenMoney[i] = 0;
        }

        // hide all chips
        var iter = 0
        this.chips.forEach(chip => {
            chip.alpha = 0.01
            this.p2Container.getAt(iter).alpha = 0.01
            this.p3Container.getAt(iter).alpha = 0.01
            iter++
        });

        // clear info text
        this.txt_info.setText("")
        this.txt_spinResult.setText("")

        this.txt_readyBtn.setStyle({color: '#FFFFFF'})

        this.ready = false
        this.canSpin = true
        this.betsPlaced = false
    }

    payout(wheelResult) {
        var bet
        var totalPayout = 0

        if (wheelResult[0] != 0) { // account for special case of 0

            // straight up 35:1
            bet = this.straightUp[wheelResult[0] - 1] // -1 to translate to index value
            totalPayout += bet*36

            // split
            // street
            // cornerBet
            // line

            // dozens
            var whichDozen = Math.ceil(wheelResult[0] / 12)
            bet = this.dozensCols[whichDozen - 1] // translate to index
            totalPayout += bet*3
            // columns
            var rm = wheelResult[0] % 3
            var whichCol
            if (rm == 1) {
                whichCol = 3
            } else if (rm == 2) {
                whichCol = 4
            } else if (rm == 0) {
                whichCol = 5
            }
            bet = this.dozensCols[whichCol]
            totalPayout += bet*3

            // even money
            // 18s
            if (wheelResult[0] <= 18) {
                totalPayout += this.evenMoney[0]*2
            } else {
                totalPayout += this.evenMoney[5]*2
            }
            // even and odd
            if (wheelResult[0] % 2 == 0) {
                totalPayout += this.evenMoney[1]*2
            } else {
                totalPayout += this.evenMoney[4]*2
            }
            // always bet on black
            if (wheelResult[1] == 0) {
                totalPayout += this.evenMoney[3]*2
            } else if (wheelResult[1] == 1) {
                totalPayout += this.evenMoney[2]*2
            }
        }
        
        return totalPayout
    }

    // populate the bet table of the other players with chip images
    populateBetTables(container) {
        // all this code is the same as with p1's bet table but with no interactive aspects
        const chipOffsetX = -14
        const chipOffsetY = -261
        var x = chipOffsetX;
        var y = chipOffsetY;
        var chipScale = 0.20

        // straight-up bet chips
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 3; j++) { 
                let chip = this.add.image(x, y, "chip")
                chip.setScale(chipScale)
                chip.alpha = 0.01
                container.add(chip)
                x += 59
            }
            y += 47.6
            x = chipOffsetX
        }
        // dozens
        x = chipOffsetX - 48
        y = chipOffsetY + 20
        for (let i=0; i<3; i++) {
            let chip = this.add.image(x, y, "chip")
            chip.setScale(chipScale)
            chip.alpha = 0.01
            container.add(chip)
            y += 190.4
        }
        // columns
        x = chipOffsetX
        y = chipOffsetY + 571.2
        for (let i=3; i<6; i++) {
            let chip = this.add.image(x, y, "chip")
            chip.setScale(chipScale)
            chip.alpha = 0.01
            container.add(chip)
            x += 59
        }
        // even money
        x = chipOffsetX - 84
        y = chipOffsetY + 25
        for (let i=0; i<6; i++) {
            let chip = this.add.image(x, y, "chip")
            chip.setScale(chipScale)
            chip.alpha = 0.01
            container.add(chip)
            y += 95
        }
    }

    updateBetTables(container, alphasArr) {
        var iter = 0
        container.getAll().forEach(chip => {
            chip.alpha = alphasArr[iter]
            iter++
        })
    }

    updateP2Txt(spinResult) {
        // name
        this.txt_p2Name.setText(this.player2.name)
        // info
        var txt = ""
        // isReady
        if (this.player2.isReady) {
            txt += "READY!\n"
        } else {
            txt += "Not Ready.\n"
        }
        // bet
        txt += `\nTotal wager:\n${this.player2.bet}\n`
        // total
        txt += `\nSession total:\n${this.player2.total}\n`
        // win
        txt += `\nLast spin:\n${spinResult}`
        if (spinResult > 0) {
            txt += " credit profit!"
        }
        // update text field
        this.txt_p2Info.setText(txt)
    }
    updateP3Txt(spinResult) {
        // name
        this.txt_p3Name.setText(this.player3.name)
        // info
        var txt = ""
        // isReady
        if (this.player3.isReady) {
            txt += "READY!\n"
        } else {
            txt += "Not Ready.\n"
        }
        // bet
        txt += `\nTotal wager:\n${this.player3.bet}\n`
        // total
        txt += `\nSession total:\n${this.player3.total}\n`
        // win
        txt += `\nLast spin:\n${spinResult}`
        if (spinResult > 0) {
            txt += " credit profit!"
        }
        // update text field
        this.txt_p3info.setText(txt)
    }

    resizeScene(gameSize) {
        const scaleFactor = Math.min(gameSize.width / 1600, gameSize.height / 850)
        this.sceneContainer.setScale(scaleFactor)
    }
}

// putting it all in a React component
const RouletteGameById = () => {
  const gameRef = useRef(null)
  const [gameInstance, setGameInstance] = useState(null)
  const { roomId } = useParams();

  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth - 10,
      height: window.innerHeight - 10,
      backgroundColor: '#236E45',
      parent: 'phaser-game',
      scene: [],
      scale: {
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY
      },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game
    setGameInstance(game)

    game.scene.add('RouletteScene', RouletteScene, true, { roomId })

    return () => {
      game.destroy(true)
    }
  }, [])

  return <div id="phaser-game"></div>
}

export default RouletteGameById