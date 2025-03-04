import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    rides: [],
    activeRide: null,  // Stores the currently active ride
};

const rideSlice = createSlice({
    name: "rides",
    initialState,
    reducers: {
        addRide: (state, action) => {
            state.rides.push(action.payload);
        },
        setActiveRide: (state, action) => {
            state.activeRide = action.payload;
        },
        removeRide: (state, action) => {
            state.rides = state.rides.filter(ride => ride.id !== action.payload);
        },
    },
});

export const { addRide, setActiveRide, removeRide } = rideSlice.actions;
export default rideSlice.reducer;
