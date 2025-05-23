import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore, writeBatch, arrayUnion, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useParams } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import { Client } from 'colyseus.js';
import { Typography, Box, TextField, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Card, FormControl, InputLabel, Select, MenuItem, CircularProgress } from "@mui/material";
import Grid from '@mui/material/Grid2';
import { useTheme } from "@mui/material/styles";

const db = getFirestore();
const auth = getAuth();

function ViewOrgById() {
    const [orgName, setOrgName] = useState("");
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [client, setClient] = useState(null);
    const { orgId } = useParams();
    const theme = useTheme();
    const [allowedGames, setAllowedGames] = useState({
        allowBlackJack: false,
        allowPoker: false,
        allowHorseRacing: false,
        allowRoulette: false,
        allowBaccarat: false
    });
    const [lobbyType, setLobbyType] = useState("Public");
    const [defaultBalance, setDefaultBalance] = useState(0);
    const [isOwner, setIsOwner] = useState(false);
    const [buttonIsLoading, setButtonIsLoading] = useState(false);

    useEffect(() => {
        const colyseusClient = new Client(`${import.meta.env.VITE_COLYSEUS_URL}`);
        setClient(colyseusClient);
        fetchAvailableRooms(colyseusClient);

        // Refresh room list periodically
        const interval = setInterval(() => {
            fetchAvailableRooms(colyseusClient);
        }, 5000);

        const fetchOrgData = async () => {
            try {
                const orgDocRef = doc(db, "orgs", orgId);
                const orgDoc = await getDoc(orgDocRef);

                if (orgDoc.exists()) {
                    const orgData = orgDoc.data();
                    setOrgName(orgData.name || "Unknown Organization");
                    setDefaultBalance(orgData.defaultBalance || 0);

                    const memberList = await Promise.all(
                        (orgData.member || []).map(async (member) => {
                            const userRef = doc(db, "users", member.id);
                            const userSnap = await getDoc(userRef);

                            return {
                                ...member,
                                joinedAt: member.joinedAt?.toDate(),
                                balance: userSnap.exists() ? (userSnap.data().balance ?? 0) : 0,
                            };
                        })
                    );

                    memberList.sort((a, b) => b.balance - a.balance);
                    setMembers(memberList);

                    setAllowedGames({
                        allowBlackJack: orgData.allowBlackJack,
                        allowPoker: orgData.allowPoker,
                        allowHorseRacing: orgData.allowHorseRacing,
                        allowRoulette: orgData.allowRoulette,
                        allowBaccarat: orgData.allowBaccarat
                    });
                }
            }
            catch (err) {
                console.error("ERROR:", err);
                setError("Error loading organization data");
            }
            finally {
                setLoading(false);
            }
        };

        fetchOrgData();
        return () => clearInterval(interval);
    }, [orgId]);

    // check if user is an owner
    useEffect(() => {
        const checkOwner = async () => {
            const currentUser = auth.currentUser;

            if (currentUser) {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                // if user is an owner
                if (userDoc.exists() && userDoc.data().owner === true) {
                    setIsOwner(true);
                }
            }
        };

        checkOwner();
    }, []);

    const [roomId, setRoomId] = useState("");
    const [availableRooms, setAvailableRooms] = useState([]);
    const navigate = useNavigate();

    const [showGames, setShowGames] = useState(false);

    const [gameSelections, setGameSelections] = useState({
        blackjack: 0,
        poker: 0,
        horseRacing: 0,
        roulette: 0,
        baccarat: 0
    });

    // open game selection screen when user presses create room
    const openGameSelection = () => {
        setShowGames(true);
    };

    // when the user is okay with the games selected
    const handleConfirm = async () => {
        const totalRooms = gameSelections.blackjack + gameSelections.poker + gameSelections.horseRacing + gameSelections.roulette + gameSelections.baccarat;
        const currentUser = auth.currentUser;

        // if no games are chosen, return and give error message
        if (totalRooms < 1) {
            alert("You must select at least one room.");
            return;
        }

        const postData = {
            roomType: "lobby",
            lobbyType: lobbyType,
            options: {
                owner: localStorage.getItem("firebaseIdToken"),
                blackjack: gameSelections.blackjack,
                poker: gameSelections.poker,
                horseracing: gameSelections.horseRacing,
                roulette: gameSelections.roulette,
                baccarat: gameSelections.baccarat
            }
        };

        try {
            const response = await fetch(`${import.meta.env.VITE_COLYSEUS_HTTP_URL}/create-room`, {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(postData)
            });

            const jsonResponse = await response.json();

            // pass games to room
            if (response.ok && jsonResponse.roomId) {
                navigate(`/room/${jsonResponse.roomId}`, { state: { games: gameSelections, lobbyType: lobbyType } });
            }
            else {
                console.error("ERROR: ", jsonResponse);
            }
        }
        catch (error) {
            console.error('ERROR: ', error);
        }
    };

    // when game value changes
    const handleGameChange = (game, value) => {
        const intVal = Math.max(0, Math.min(3, parseInt(value) || 0));

        setGameSelections(prev => ({
            ...prev,
            [game]: intVal,
        }));
    };

    const joinRoom = () => {
        if (roomId) {
            navigate(`/room/${roomId}`);
        }
        else {
            alert("Please enter a valid room ID.");
        }
    };

    const fetchAvailableRooms = async (client) => {
        try {
            const rooms = await client.getAvailableRooms('lobby');
            setAvailableRooms(rooms);
        }
        catch (e) {
            setError('ERROR: failed to fetch rooms');
        }
    };

    const [mainHeight, setMainHeight] = useState('100vh');

    useEffect(() => {
        const header = document.getElementById('header');
        if (header) {
            const headerHeight = header.offsetHeight;
            setMainHeight(`calc(100vh - ${headerHeight}px)`);
        }
    }, []);

    useEffect(() => {
        document.body.style.backgroundColor = "#ffe5bd";
        return () => {
            document.body.style.backgroundColor = '';
        };
    }, []);

    // This function resets the balance for all members to the org's defaultBalance.
    const resetBalances = async () => {
        setButtonIsLoading(true);
        try {
            /////////////////////////
            //// saving balances ////
            /////////////////////////

            const orgRef = doc(db, "orgs", orgId);
            const orgSnap = await getDoc(orgRef);

            // create snapshot of leaderboard before resetting
            const leaderboardSnapshot = {
                date: new Date(),

                members: members.map(member => ({
                    name: member.name,
                    balance: member.balance
                }))
            };

            // save
            await updateDoc(orgRef, {
                leaderboardHistory: arrayUnion(leaderboardSnapshot)
            });

            ////////////////////////////
            //// resetting balances ////
            ////////////////////////////

            const batch = writeBatch(db);

            for (const member of members) {
                const userRef = doc(db, "users", member.id);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    batch.update(userRef, { balance: defaultBalance });
                }
            }

            await batch.commit();
            setButtonIsLoading(false);
            alert("Balances reset successfully!");
            window.location.reload();
        }
        catch (error) {
            console.error("ERROR: ", error);
            setButtonIsLoading(false);
            alert("Failed to reset balances.");
        }
    };



    return (
        <Box component="main" sx={{ padding: 0, height: mainHeight }}>
            <Grid container spacing={0}
                sx={{
                    width: '100%',
                    height: '100%',
                }}
            >

                {/* Left side */}
                <Grid size={6}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <Card
                        sx={{
                            margin: '16px 8px 16px 16px',
                            padding: '10px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Typography variant="heading"
                            sx={{
                                fontSize: '2.5vw',
                                color: theme.palette.primary.main,
                            }}
                        >
                            {orgName}
                        </Typography>
                    </Card>
                    <Card
                        sx={{
                            flexGrow: 1,
                            margin: '0 8px 16px 16px',
                            padding: '20px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {!loading && members.length > 0 && (
                            <>
                                <Typography variant="heading"
                                    sx={{
                                        color: theme.palette.primary.main,
                                        fontSize: '1.5vw',
                                        margin: '0 0 10px 0',
                                    }}
                                >
                                    Members
                                </Typography>
                                <TableContainer sx={{ borderRadius: '8px' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ backgroundColor: theme.palette.secondary.main }}>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Name</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Email</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Joined</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Balance</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {members.map((member, index) => (
                                                <TableRow
                                                    key={index}
                                                    sx={{ backgroundColor: "#fffced", '&:last-child td, &:last-child th': { border: 0 } }}
                                                >
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}><Link href={`/user/${member.id}`} sx={{ color: "#998100", textDecorationColor: "#d9b800" }}>{member.name}</Link></TableCell>
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}>{member.email}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}>{member.balance.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {/*reset balance button for owners*/}
                                {isOwner && (
                                    <Button
                                        onClick={resetBalances}
                                        variant="contained"
                                        disabled={buttonIsLoading}
                                        sx={{
                                            marginTop: '10px',
                                            backgroundColor: theme.palette.error.main,
                                            color: theme.palette.error.contrastText,
                                            "&:hover": {
                                                backgroundColor: theme.palette.error.dark,
                                            },
                                            textTransform: "none",
                                        }}
                                    >
                                        {buttonIsLoading ? <CircularProgress size={25} /> : <Typography variant="btn">Reset Balances</Typography>}
                                    </Button>
                                )}

                            </>
                        )}
                        {!loading && members.length === 0 && <p>No members found.</p>}
                    </Card>
                </Grid>

                {/* Right side */}
                <Grid size={6}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <Card
                        sx={{
                            margin: '16px 16px 16px 8px',
                            padding: '20px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'row',
                        }}
                    >

                        <Grid size={6}>

                            <Typography variant="heading"
                                sx={{
                                    fontSize: '1.5vw',
                                    color: theme.palette.primary.main,
                                }}
                            >
                                Create New Room
                            </Typography>
                            <br />
                            <Button onClick={openGameSelection} variant="contained" size="large"
                                sx={{
                                    backgroundColor: theme.palette.secondary.main,
                                    color: theme.palette.secondary.contrastText,
                                    "&:hover": {
                                        backgroundColor: theme.palette.secondary.dark,
                                    },
                                    borderRadius: "40px",
                                    textTransform: "none",
                                    padding: "5px 32px",
                                    fontSize: "1.5rem",
                                    margin: "10px 0px",
                                }}
                            >
                                <Typography variant="btn">Create Room</Typography>
                            </Button>
                        </Grid>

                        <Grid size={6}>
                            <Typography variant="heading"
                                sx={{
                                    fontSize: '1.5vw',
                                    color: theme.palette.primary.main,
                                }}
                            >
                                Join Room by Code
                            </Typography>

                            <Box
                                sx={{
                                    display: 'flex',
                                }}
                            >
                                <Box className="form" sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alighnItems: 'center', width: '100%' }}>
                                    <TextField flexgrow='1' variant="outlined" margin="dense" type="text" label="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)}
                                        sx={{
                                            flexGrow: 1,
                                            marginRight: '10px',
                                            backgroundColor: 'white',
                                            '& .MuiInputLabel-root': {
                                                ...theme.typography.general,
                                            },
                                            '& .MuiInputBase-input': {
                                                ...theme.typography.general,
                                            },

                                            '& .MuiOutlinedInput-root': {
                                                '&.Mui-focused fieldset': {
                                                    borderColor: theme.palette.secondary.main,
                                                },
                                            },
                                        }}
                                    />

                                    <Button onClick={() => joinRoom(roomId)} variant="contained" size="large"
                                        sx={{
                                            backgroundColor: theme.palette.secondary.main,
                                            color: theme.palette.secondary.contrastText,
                                            "&:hover": {
                                                backgroundColor: theme.palette.secondary.dark,
                                            },
                                            borderRadius: "40px",
                                            textTransform: "none",
                                            padding: "5px 32px",
                                            fontSize: "1.5rem",
                                            margin: "10px 0px",
                                        }}
                                    >
                                        <Typography variant="btn">Join</Typography>
                                    </Button>
                                </Box>
                            </Box>
                        </Grid>
                    </Card>

                    <Card
                        sx={{
                            margin: '0 16px 16px 8px',
                            padding: '20px',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            flexGrow: 1,
                        }}
                    >
                        {loading && <p>Loading...</p>}
                        {error && <p>{error}</p>}
                        <>
                            <Typography variant="heading"
                                sx={{
                                    fontSize: '1.5vw',
                                    margin: '0 0 10px 0',
                                    color: theme.palette.primary.main,
                                }}
                            >
                                Public Rooms
                            </Typography>
                            <TableContainer sx={{ borderRadius: '8px' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: theme.palette.secondary.main }}>
                                            {/* <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Type</TableCell> */}
                                            {/* <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Host</TableCell> */}
                                            {/* <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Game</TableCell> */}
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Room ID</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Players</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {availableRooms.length > 0 ? (
                                            availableRooms.map((room) => (
                                                <TableRow
                                                    key={room.roomId}
                                                    sx={{ backgroundColor: "#fffced", '&:last-child td, &:last-child th': { border: 0 } }}
                                                >
                                                    {/* <TableCell sx={{ fontFamily: 'Source Code Pro' }}>Public</TableCell> */}
                                                    {/* <TableCell sx={{ fontFamily: 'Source Code Pro' }}>Temp</TableCell> */}
                                                    {/* <TableCell sx={{ fontFamily: 'Source Code Pro' }}>Temp</TableCell> */}
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}>{room.roomId}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}>{room.clients}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'Source Code Pro' }}><Link href={`/room/${room.roomId}`} sx={{ color: "#998100", textDecorationColor: "#d9b800" }}>Join</Link></TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow sx={{ backgroundColor: "#fffced", '&:last-child td, &:last-child th': { border: 0 } }}>
                                                <TableCell colSpan="5" sx={{ fontFamily: 'Source Code Pro' }}>No public rooms available.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </>

                    </Card>

                </Grid>
            </Grid>

            {/* when user selects create room, show this */}
            <Dialog open={showGames}>
                <DialogTitle><Typography variant="heading">Select Games</Typography></DialogTitle>
                <DialogContent>
                    <DialogContentText display="flex" flexDirection={"column"}>

                        {allowedGames.allowBlackJack && (
                            <TextField variant="outlined" margin="dense" type="number" min="0" max="3" label="Blackjack (0-3)" value={gameSelections.blackjack} onChange={(e) => handleGameChange("blackjack", e.target.value)}
                                sx={{
                                    backgroundColor: 'white',
                                    '& .MuiInputLabel-root': {
                                        ...theme.typography.general,
                                        fontSize: "0.75rem",
                                    },
                                    '& .MuiInputBase-input': {
                                        ...theme.typography.general,
                                    },
                                }}
                            />
                        )}

                        {allowedGames.allowPoker && (
                            <TextField variant="outlined" margin="dense" type="number" min="0" max="3" label="Poker (0-3)" value={gameSelections.poker} onChange={(e) => handleGameChange("poker", e.target.value)}
                                sx={{
                                    backgroundColor: 'white',
                                    '& .MuiInputLabel-root': {
                                        ...theme.typography.general,
                                        fontSize: "0.80rem",
                                    },
                                    '& .MuiInputBase-input': {
                                        ...theme.typography.general,
                                    },
                                }}
                            />
                        )}

                        {allowedGames.allowHorseRacing && (
                            <TextField variant="outlined" margin="dense" type="number" min="0" max="3" label="Horse Racing (0-3)" value={gameSelections.horseRacing} onChange={(e) => handleGameChange("horseRacing", e.target.value)}
                                sx={{
                                    backgroundColor: 'white',
                                    '& .MuiInputLabel-root': {
                                        ...theme.typography.general,
                                        fontSize: "0.80rem",
                                    },
                                    '& .MuiInputBase-input': {
                                        ...theme.typography.general,
                                    },
                                }}
                            />
                        )}

                        {allowedGames.allowRoulette && (
                            <TextField variant="outlined" margin="dense" type="number" min="0" max="3" label="Roulette (0-3)" value={gameSelections.roulette} onChange={(e) => handleGameChange("roulette", e.target.value)}
                                sx={{
                                    backgroundColor: 'white',
                                    '& .MuiInputLabel-root': {
                                        ...theme.typography.general,
                                        fontSize: "0.76rem",
                                    },
                                    '& .MuiInputBase-input': {
                                        ...theme.typography.general,
                                    },
                                }}
                            />
                        )}

                        {allowedGames.allowBaccarat && (
                            <TextField variant="outlined" margin="dense" type="number" min="0" max="3" label="Baccarat (0-3)" value={gameSelections.baccarat} onChange={(e) => handleGameChange("baccarat", e.target.value)}
                                sx={{
                                    backgroundColor: 'white',
                                    '& .MuiInputLabel-root': {
                                        ...theme.typography.general,
                                        fontSize: "0.78rem",
                                    },
                                    '& .MuiInputBase-input': {
                                        ...theme.typography.general,
                                    },
                                }}
                            />
                        )}

                    </DialogContentText>
                </DialogContent>

                <DialogTitle><Typography variant="heading">Lobby Info</Typography></DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ marginTop: 1 }}>
                        <InputLabel
                            sx={{
                                ...theme.typography.general,
                                fontSize: "0.85rem",
                            }}
                        >
                            Lobby Type
                        </InputLabel>

                        <Select
                            value={lobbyType}
                            onChange={(e) => setLobbyType(e.target.value)}
                            label="Lobby Type"
                            sx={{
                                backgroundColor: 'white',
                                '& .MuiInputLabel-root': {
                                    fontSize: "0.85rem",
                                },
                                '& .MuiInputBase-input': {
                                    ...theme.typography.general,
                                    fontSize: "0.85rem",
                                },
                            }}
                        >
                            <MenuItem value="Public" sx={{ ...theme.typography.general }}>Public</MenuItem>
                            <MenuItem value="Private" sx={{ ...theme.typography.general }}>Private</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>

                <DialogActions
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}
                >
                    <Button onClick={() => setShowGames(false)}
                        sx={{
                            flex: 1,
                            fontFamily: "Source Code Pro",
                            "&:hover": {
                                color: "white",
                                backgroundColor: theme.palette.primary.light,
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}
                        sx={{
                            flex: 1,
                            backgroundColor: theme.palette.primary.main,
                            color: "white",
                            fontFamily: "Source Code Pro",
                            "&:hover": {
                                backgroundColor: theme.palette.primary.dark,
                                color: "white",
                            }
                        }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
}

export default ViewOrgById;
