import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axiosInstance"; // Ensure you have a configured Axios instance

// Async action to create a ride
export const createRide = createAsyncThunk(
  "rides/createRide",
  async (rideData, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/rides/create/", rideData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Something went wrong");
    }
  }
);

const rideSlice = createSlice({
  name: "rides",
  initialState: {
    ride: null,
    isLoading: false,
    error: null,
  },
  reducers: {}, // No additional reducers needed
  extraReducers: (builder) => {
    builder
      .addCase(createRide.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createRide.fulfilled, (state, action) => {
        state.isLoading = false;
        state.ride = action.payload;
      })
      .addCase(createRide.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default rideSlice.reducer;



// import { createSlice } from "@reduxjs/toolkit";

// const initialState = {
//     rides: [],
//     activeRide: null,  // Stores the currently active ride
// };

// const rideSlice = createSlice({
//     name: "rides",
//     initialState,
//     reducers: {
//         addRide: (state, action) => {
//             state.rides.push(action.payload);
//         },
//         setActiveRide: (state, action) => {
//             state.activeRide = action.payload;
//         },
//         removeRide: (state, action) => {
//             state.rides = state.rides.filter(ride => ride.id !== action.payload);
//         },
//     },
// });

// export const { addRide, setActiveRide, removeRide } = rideSlice.actions;
// export default rideSlice.reducer;
