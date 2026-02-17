import React, { useCallback, useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';
// FIX: Removed unused imports — Box, CardActions, Button (were lines 5, 6, 8)
import { IconButton } from '@mui/material';

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const routeTo = useNavigate();

    // FIX: Wrap in useCallback so it's a stable reference usable as a useEffect dep (was line 34)
    const fetchHistory = useCallback(async () => {
        try {
            const history = await getHistoryOfUser();
            setMeetings(history);
        } catch {
            // IMPLEMENT SNACKBAR
        }
    }, [getHistoryOfUser]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]); // FIX: fetchHistory now listed as dep

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div>
            <IconButton onClick={() => routeTo("/home")}>
                <HomeIcon />
            </IconButton>
            {meetings.length !== 0 && meetings.map((e, i) => (
                <Card key={i} variant="outlined">
                    <CardContent>
                        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                            Code: {e.meetingCode}
                        </Typography>
                        <Typography sx={{ mb: 1.5 }} color="text.secondary">
                            Date: {formatDate(e.date)}
                        </Typography>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
